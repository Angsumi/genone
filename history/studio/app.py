import os
import sys
import json
import uuid
import shutil
import tornado.ioloop
import tornado.web
from PIL import Image, ImageOps

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BASE_DIR)

from studio.matcher import HeritageMatcher
from studio.updater import rebuild_all_datasets, create_thumb

UPLOAD_DIR = os.path.join(BASE_DIR, 'studio', 'uploads')
os.makedirs(UPLOAD_DIR, exist_ok=True)

matcher = HeritageMatcher()

class MainHandler(tornado.web.RequestHandler):
    def get(self):
        self.render('static/index.html')

class UploadAndCorrelateHandler(tornado.web.RequestHandler):
    def post(self):
        try:
            if 'image' not in self.request.files:
                self.set_status(400)
                self.write({'error': 'No image file uploaded'})
                return
                
            file_info = self.request.files['image'][0]
            filename = file_info['filename']
            file_bytes = file_info['body']
            
            # Save uploaded file in studio/uploads/
            upload_id = str(uuid.uuid4())[:8]
            ext = os.path.splitext(filename)[1].lower() or '.png'
            saved_name = f"upload_{upload_id}{ext}"
            saved_path = os.path.join(UPLOAD_DIR, saved_name)
            
            with open(saved_path, 'wb') as f:
                f.write(file_bytes)
                
            # Read image metadata
            with Image.open(saved_path) as im:
                im = ImageOps.exif_transpose(im)
                w, h = im.size
                aspect = round(w / h, 3)
                
            # Correlate with scope
            collection_filter = self.get_argument('collection', 'all')
            scope_filter = self.get_argument('scope', 'all') # 'all', 'unrestored', 'paired', 'das', 'upadhyaya'
            matches = matcher.find_matches(saved_path, top_k=16, collection_filter=collection_filter, scope_filter=scope_filter)
            
            self.write({
                'success': True,
                'upload_id': upload_id,
                'uploaded_file': saved_name,
                'uploaded_url': f"/uploads/{saved_name}",
                'orig_filename': filename,
                'width': w,
                'height': h,
                'aspect': aspect,
                'matches': matches
            })
        except Exception as e:
            self.set_status(500)
            self.write({'error': str(e)})

class RecorrelateHandler(tornado.web.RequestHandler):
    """Re-runs correlation for an already uploaded image with a different scope."""
    def post(self):
        try:
            data = json.loads(self.request.body.decode('utf-8'))
            uploaded_file = data.get('uploaded_file')
            scope_filter = data.get('scope', 'all')
            collection_filter = data.get('collection', 'all')
            
            saved_path = os.path.join(UPLOAD_DIR, uploaded_file)
            if not os.path.exists(saved_path):
                self.set_status(404)
                self.write({'error': 'Uploaded image not found'})
                return
                
            matches = matcher.find_matches(saved_path, top_k=16, collection_filter=collection_filter, scope_filter=scope_filter)
            self.write({
                'success': True,
                'matches': matches
            })
        except Exception as e:
            self.set_status(500)
            self.write({'error': str(e)})

class ConfirmMatchHandler(tornado.web.RequestHandler):
    def post(self):
        try:
            data = json.loads(self.request.body.decode('utf-8'))
            upload_file = data.get('upload_file') # e.g. upload_abcd1234.png
            target_collection = data.get('collection') # 'das' or 'upadhyaya'
            target_file = data.get('target_file') # original file name, e.g. das_raw_012.jpg or das_071_orig.jpg
            target_status = data.get('target_status') # 'unrestored' or 'paired'
            rotation = int(data.get('rotation', 0))
            
            upload_path = os.path.join(UPLOAD_DIR, upload_file)
            if not os.path.exists(upload_path):
                self.set_status(404)
                self.write({'error': 'Uploaded file expired or missing'})
                return

            c_dir = os.path.join(BASE_DIR, 'collections', target_collection)
            orig_dir = os.path.join(c_dir, 'original')
            rest_dir = os.path.join(c_dir, 'restored')
            unrest_dir = os.path.join(c_dir, 'unrestored')

            if target_status == 'unrestored':
                # Target was an unrestored raw file
                raw_path = os.path.join(unrest_dir, target_file)
                if not os.path.exists(raw_path):
                    self.set_status(404)
                    self.write({'error': f'Unrestored file {target_file} not found'})
                    return
                
                # Determine new pair index
                current_pairs = sorted(os.listdir(orig_dir))
                next_idx = len(current_pairs) + 1
                new_orig_name = f"{target_collection}_{next_idx:03d}_orig.jpg"
                new_rest_name = f"{target_collection}_{next_idx:03d}_restored.png"
                
                new_orig_path = os.path.join(orig_dir, new_orig_name)
                new_rest_path = os.path.join(rest_dir, new_rest_name)
                
                # Move/Save original
                with Image.open(raw_path) as im:
                    im = ImageOps.exif_transpose(im)
                    if rotation != 0:
                        im = im.rotate(rotation, expand=True)
                    if im.mode in ('RGBA', 'P'):
                        im = im.convert('RGB')
                    im.save(new_orig_path, 'JPEG', quality=95)
                    
                # Delete old raw file from unrestored
                os.remove(raw_path)
                
                # Copy uploaded restored image into restored directory
                with Image.open(upload_path) as im:
                    im = ImageOps.exif_transpose(im)
                    im.save(new_rest_path, 'PNG')
                    
                # Renumber remaining unrestored files
                rem_unrest = sorted(os.listdir(unrest_dir))
                for i, f in enumerate(rem_unrest):
                    old_p = os.path.join(unrest_dir, f)
                    new_p = os.path.join(unrest_dir, f"{target_collection}_raw_{i+1:03d}.jpg")
                    if old_p != new_p:
                        os.rename(old_p, new_p)

            else:
                # Correcting an existing paired item (like das-071)
                parts = target_file.split('_')
                pair_idx_str = parts[1]
                rest_name = f"{target_collection}_{pair_idx_str}_restored.png"
                rest_path = os.path.join(rest_dir, rest_name)
                
                # Overwrite or update the restored image with the new upload
                with Image.open(upload_path) as im:
                    im = ImageOps.exif_transpose(im)
                    im.save(rest_path, 'PNG')

            # Re-index matcher database
            matcher.precompute_database()
            
            # Rebuild datasets and synchronize website HTML
            stats = rebuild_all_datasets()
            
            self.write({
                'success': True,
                'message': f'Successfully updated {target_collection} archive!',
                'stats': stats
            })
        except Exception as e:
            self.set_status(500)
            self.write({'error': str(e)})

class GetDatabaseHandler(tornado.web.RequestHandler):
    def get(self):
        """Returns all unrestored and paired photos for manual selection."""
        unrestored_items = [
            {
                'collection': item['collection'],
                'filename': item['filename'],
                'rel_path': item['rel_path'],
                'thumb_rel': item['thumb_rel'],
                'width': item['width'],
                'height': item['height'],
                'aspect': item['aspect'],
                'orientation': item['orientation']
            }
            for item in matcher.database if item['status'] == 'unrestored'
        ]
        paired_items = [
            {
                'collection': item['collection'],
                'filename': item['filename'],
                'rel_path': item['rel_path'],
                'thumb_rel': item['thumb_rel'],
                'width': item['width'],
                'height': item['height'],
                'aspect': item['aspect'],
                'orientation': item['orientation']
            }
            for item in matcher.database if item['status'] == 'paired'
        ]
        self.write({
            'unrestored': unrestored_items,
            'paired': paired_items
        })

def make_app():
    return tornado.web.Application([
        (r"/", MainHandler),
        (r"/api/upload", UploadAndCorrelateHandler),
        (r"/api/recorrelate", RecorrelateHandler),
        (r"/api/confirm", ConfirmMatchHandler),
        (r"/api/database", GetDatabaseHandler),
        (r"/uploads/(.*)", tornado.web.StaticFileHandler, {"path": UPLOAD_DIR}),
        (r"/collections/(.*)", tornado.web.StaticFileHandler, {"path": os.path.join(BASE_DIR, "collections")}),
        (r"/assets/(.*)", tornado.web.StaticFileHandler, {"path": os.path.join(BASE_DIR, "assets")}),
        (r"/(.*)", tornado.web.StaticFileHandler, {"path": os.path.join(BASE_DIR, "studio", "static")}),
    ], template_path=os.path.join(BASE_DIR, 'studio'))

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    app = make_app()
    app.listen(port)
    print(f"==================================================")
    print(f" Rangachakua Heritage Restorer Studio is running! ")
    print(f" Open http://localhost:{port} in your browser     ")
    print(f"==================================================")
    tornado.ioloop.IOLoop.current().start()
