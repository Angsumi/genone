import os
import glob
import numpy as np
from PIL import Image, ImageOps, ImageFilter

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def get_feat(im, size=(64, 64)):
    """Extract normalized blurred feature vector for cross-correlation."""
    img = im.convert('L').resize(size, Image.Resampling.BILINEAR).filter(ImageFilter.GaussianBlur(1.0))
    arr = np.asarray(img, dtype=np.float32)
    arr = (arr - arr.mean()) / (arr.std() + 1e-6)
    return arr

class HeritageMatcher:
    def __init__(self):
        self.cache = {}
        self.precompute_database()

    def precompute_database(self):
        """Index all unrestored photos and existing paired originals for correlation."""
        self.database = []
        
        for collection in ['das', 'upadhyaya']:
            c_dir = os.path.join(BASE_DIR, 'collections', collection)
            
            # 1. Unrestored items (primary target for new upscales)
            unrest_dir = os.path.join(c_dir, 'unrestored')
            if os.path.exists(unrest_dir):
                for f in sorted(os.listdir(unrest_dir)):
                    if not f.lower().endswith(('.jpg', '.jpeg', '.png')): continue
                    p = os.path.join(unrest_dir, f)
                    self._add_to_index(p, collection, 'unrestored', f)
                    
            # 2. Existing paired originals (in case user wants to re-pair or correct, e.g. das-071)
            orig_dir = os.path.join(c_dir, 'original')
            if os.path.exists(orig_dir):
                for f in sorted(os.listdir(orig_dir)):
                    if not f.lower().endswith(('.jpg', '.jpeg', '.png')): continue
                    p = os.path.join(orig_dir, f)
                    self._add_to_index(p, collection, 'paired', f)

    def _add_to_index(self, path, collection, status, filename):
        try:
            with Image.open(path) as im:
                im = ImageOps.exif_transpose(im)
                w, h = im.size
                aspect = round(w / h, 3)
                
                # Precompute 4 rotations
                rot_feats = [get_feat(im.rotate(rot, expand=True)) for rot in [0, 90, 180, 270]]
                
                # Associated thumbnail if exists
                rel_path = os.path.relpath(path, BASE_DIR)
                thumb_rel = None
                if status == 'unrestored':
                    num = filename.split('_')[-1].split('.')[0]
                    thumb_rel = f"assets/thumbs/{collection}/unrestored_{num}.jpg"
                else:
                    num = filename.split('_')[1]
                    thumb_rel = f"assets/thumbs/{collection}/orig_{num}.jpg"
                    
                self.database.append({
                    'path': path,
                    'rel_path': rel_path,
                    'thumb_rel': thumb_rel if os.path.exists(os.path.join(BASE_DIR, thumb_rel or '')) else rel_path,
                    'collection': collection,
                    'status': status,
                    'filename': filename,
                    'width': w,
                    'height': h,
                    'aspect': aspect,
                    'orientation': 'landscape' if w > h else ('portrait' if h > w else 'square'),
                    'feats': rot_feats
                })
        except Exception as e:
            print(f"Failed indexing {path}: {e}")

    def find_matches(self, uploaded_img_path, top_k=12, collection_filter='all', scope_filter='all'):
        """
        Correlate uploaded image against indexed database across 4 rotations.
        scope_filter: 'all', 'unrestored', 'paired', 'das', 'upadhyaya'
        """
        with Image.open(uploaded_img_path) as im:
            im = ImageOps.exif_transpose(im)
            u_w, u_h = im.size
            u_aspect = round(u_w / u_h, 3)
            f_target = get_feat(im)

        candidates = []
        for item in self.database:
            # Check collection filter
            if collection_filter and collection_filter != 'all' and item['collection'] != collection_filter:
                continue

            # Check scope filter
            if scope_filter == 'unrestored' and item['status'] != 'unrestored':
                continue
            elif scope_filter == 'paired' and item['status'] != 'paired':
                continue
            elif scope_filter == 'das' and item['collection'] != 'das':
                continue
            elif scope_filter == 'upadhyaya' and item['collection'] != 'upadhyaya':
                continue

            rot_scores = [float(np.mean(f_target * f_rot)) for f_rot in item['feats']]
            max_idx = int(np.argmax(rot_scores))
            best_sc = rot_scores[max_idx]
            best_rot = max_idx * 90

            # Confidence percentage
            confidence = max(0, min(100, int((best_sc - 0.2) / 0.7 * 100))) if best_sc > 0.2 else int(max(0, best_sc * 100))
            
            candidates.append({
                'score': round(best_sc, 4),
                'confidence': confidence,
                'rotation': best_rot,
                'collection': item['collection'],
                'status': item['status'],
                'filename': item['filename'],
                'rel_path': item['rel_path'],
                'thumb_rel': item['thumb_rel'],
                'width': item['width'],
                'height': item['height'],
                'aspect': item['aspect'],
                'orientation': item['orientation']
            })

        # Sort strictly by correlation score descending
        candidates.sort(key=lambda x: x['score'], reverse=True)
        return candidates[:top_k]
