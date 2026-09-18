import os
import json
import shutil
from PIL import Image, ImageOps

def create_thumb(src_path, dest_path, max_dim=800):
    os.makedirs(os.path.dirname(dest_path), exist_ok=True)
    if os.path.exists(dest_path):
        return
    try:
        with Image.open(src_path) as im:
            im = ImageOps.exif_transpose(im)
            im.thumbnail((max_dim, max_dim), Image.Resampling.LANCZOS)
            if im.mode in ('RGBA', 'P'):
                im = im.convert('RGB')
            im.save(dest_path, 'JPEG', quality=82, optimize=True)
    except Exception as e:
        print(f"Error creating thumbnail for {src_path}: {e}")

def clean_and_rebuild():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    
    # 1. Delete duplicates in Upadhyaya unrestored
    u_dups = ['upadhyaya_raw_001.jpg', 'upadhyaya_raw_003.jpg', 'upadhyaya_raw_004.jpg', 'upadhyaya_raw_006.jpg']
    u_unrest_dir = os.path.join(base_dir, 'collections/upadhyaya/unrestored')
    for f in u_dups:
        p = os.path.join(u_unrest_dir, f)
        if os.path.exists(p):
            os.remove(p)
            print(f"Deleted duplicate: {p}")
            
    # Renumber remaining Upadhyaya unrestored
    remaining_u = sorted(os.listdir(u_unrest_dir))
    for i, f in enumerate(remaining_u):
        old_p = os.path.join(u_unrest_dir, f)
        new_name = f"upadhyaya_raw_{i+1:03d}.jpg"
        new_p = os.path.join(u_unrest_dir, new_name)
        if old_p != new_p:
            os.rename(old_p, new_p)
            
    # 2. Delete duplicates in Das unrestored
    d_dups = [
        'das_raw_002.jpg', 'das_raw_003.jpg', 'das_raw_011.jpg', 'das_raw_025.jpg',
        'das_raw_027.jpg', 'das_raw_028.jpg', 'das_raw_039.jpg', 'das_raw_060.jpg',
        'das_raw_061.jpg', 'das_raw_091.jpg', 'das_raw_092.jpg', 'das_raw_093.jpg'
    ]
    d_unrest_dir = os.path.join(base_dir, 'collections/das/unrestored')
    for f in d_dups:
        p = os.path.join(d_unrest_dir, f)
        if os.path.exists(p):
            os.remove(p)
            print(f"Deleted duplicate: {p}")
            
    # Renumber remaining Das unrestored
    remaining_d = sorted(os.listdir(d_unrest_dir))
    for i, f in enumerate(remaining_d):
        old_p = os.path.join(d_unrest_dir, f)
        new_name = f"das_raw_{i+1:03d}.jpg"
        new_p = os.path.join(d_unrest_dir, new_name)
        if old_p != new_p:
            os.rename(old_p, new_p)

    # 3. Re-generate thumbs and datasets
    # Clean previous thumbnails
    shutil.rmtree(os.path.join(base_dir, 'assets/thumbs'), ignore_errors=True)
    os.makedirs(os.path.join(base_dir, 'assets/thumbs/upadhyaya'), exist_ok=True)
    os.makedirs(os.path.join(base_dir, 'assets/thumbs/das'), exist_ok=True)
    
    # Process both
    for prefix in ['upadhyaya', 'das']:
        print(f"\nRebuilding {prefix.upper()} dataset with unrestored stacked at end...")
        c_base = os.path.join(base_dir, 'collections', prefix)
        orig_dir = os.path.join(c_base, 'original')
        rest_dir = os.path.join(c_base, 'restored')
        unrest_dir = os.path.join(c_base, 'unrestored')
        
        orig_files = sorted(os.listdir(orig_dir))
        rest_files = sorted(os.listdir(rest_dir))
        unrest_files = sorted(os.listdir(unrest_dir)) if os.path.exists(unrest_dir) else []
        
        pairs = []
        for idx, (o_f, r_f) in enumerate(zip(orig_files, rest_files)):
            o_path = os.path.join(orig_dir, o_f)
            r_path = os.path.join(rest_dir, r_f)
            
            with Image.open(o_path) as o_im:
                o_w, o_h = o_im.size
            with Image.open(r_path) as r_im:
                r_w, r_h = r_im.size
                
            pair_num = idx + 1
            pair_id = f"{prefix}-{pair_num:03d}"
            
            # Special landmark titles
            if pair_id == 'upadhyaya-019':
                title = 'Historic Rangachakua Bazar'
                is_featured = True
                feat_tag = 'Rangachakua Bazar'
            elif pair_id == 'das-046':
                title = 'Rangachakua Village Centre (1976)'
                is_featured = True
                feat_tag = 'Village Centre (1976)'
            else:
                title = f"{prefix.capitalize()} Heritage Photo #{pair_num:03d}"
                is_featured = False
                feat_tag = None
                
            o_thumb = f"assets/thumbs/{prefix}/orig_{pair_num:03d}.jpg"
            r_thumb = f"assets/thumbs/{prefix}/restored_{pair_num:03d}.jpg"
            
            create_thumb(o_path, os.path.join(base_dir, o_thumb), max_dim=800)
            create_thumb(r_path, os.path.join(base_dir, r_thumb), max_dim=800)
            
            pairs.append({
                'id': pair_id,
                'title': title,
                'orig_file': o_f,
                'orig_path': os.path.relpath(o_path, base_dir),
                'orig_thumb': o_thumb,
                'orig_width': o_w,
                'orig_height': o_h,
                'orig_aspect': round(o_w / o_h, 3),
                'clear_file': r_f,
                'clear_path': os.path.relpath(r_path, base_dir),
                'clear_thumb': r_thumb,
                'clear_width': r_w,
                'clear_height': r_h,
                'clear_aspect': round(r_w / r_h, 3),
                'orientation': 'landscape' if r_w > r_h else ('portrait' if r_h > r_w else 'square'),
                'score': 0.95,
                'is_paired': True,
                'is_featured': is_featured,
                'featured_tag': feat_tag
            })
            
        # Move featured landmark to index 0 of pairs
        if prefix == 'upadhyaya':
            u19 = [p for p in pairs if p['id'] == 'upadhyaya-019'][0]
            pairs.remove(u19)
            pairs.insert(0, u19)
        elif prefix == 'das':
            d46 = [p for p in pairs if p['id'] == 'das-046'][0]
            pairs.remove(d46)
            pairs.insert(0, d46)
            
        # Unpaired / unrestored items placed AT END
        unpaired = []
        for idx, u_f in enumerate(unrest_files):
            u_path = os.path.join(unrest_dir, u_f)
            with Image.open(u_path) as u_im:
                u_w, u_h = u_im.size
                
            u_num = idx + 1
            u_thumb = f"assets/thumbs/{prefix}/unrestored_{u_num:03d}.jpg"
            create_thumb(u_path, os.path.join(base_dir, u_thumb), max_dim=800)
            
            unpaired.append({
                'id': f"{prefix}-raw-{u_num:03d}",
                'title': f"{prefix.capitalize()} Original #{u_num:03d} (Still Needs to be Restored)",
                'orig_file': u_f,
                'orig_path': os.path.relpath(u_path, base_dir),
                'orig_thumb': u_thumb,
                'orig_width': u_w,
                'orig_height': u_h,
                'orig_aspect': round(u_w / u_h, 3),
                'orientation': 'landscape' if u_w > u_h else ('portrait' if u_h > u_w else 'square'),
                'is_paired': False,
                'needs_restoration': True,
                'featured_tag': 'Needs Restoration'
            })
            
        total_unique_origs = len(pairs) + len(unpaired)
        data = {
            'collection': prefix,
            'total_orig': total_unique_origs,
            'total_clear': len(pairs),
            'total_paired': len(pairs),
            'total_unpaired': len(unpaired),
            'pairs': pairs,
            'unpaired': unpaired
        }
        
        out_json = os.path.join(base_dir, f'data_{prefix}.json')
        out_js = os.path.join(base_dir, f'data_{prefix}.js')
        
        with open(out_json, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2)
            
        with open(out_js, 'w', encoding='utf-8') as f:
            f.write(f"window.DATA_{prefix.upper()} = " + json.dumps(data, indent=2) + ";\n")
            
        print(f"Saved {out_json} & {out_js}: {len(pairs)} restored pairs, {len(unpaired)} unrestored stacked at end.")
        
    print("\nClean and rebuild finished successfully!")

if __name__ == '__main__':
    clean_and_rebuild()
