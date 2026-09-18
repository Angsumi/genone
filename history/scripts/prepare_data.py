import os
import json
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

def process_organized_collection(prefix, output_json):
    print(f"\n========================================")
    print(f"Building Dataset for {prefix.upper()}")
    print(f"========================================")
    
    base = os.path.join('collections', prefix)
    orig_dir = os.path.join(base, 'original')
    rest_dir = os.path.join(base, 'restored')
    unrest_dir = os.path.join(base, 'unrestored')
    
    orig_files = sorted([f for f in os.listdir(orig_dir) if f.lower().endswith(('.jpg', '.jpeg', '.png'))])
    rest_files = sorted([f for f in os.listdir(rest_dir) if f.lower().endswith(('.jpg', '.jpeg', '.png'))])
    unrest_files = sorted([f for f in os.listdir(unrest_dir) if f.lower().endswith(('.jpg', '.jpeg', '.png'))]) if os.path.exists(unrest_dir) else []
    
    pairs = []
    for idx, (o_f, r_f) in enumerate(zip(orig_files, rest_files)):
        o_path = os.path.join(orig_dir, o_f)
        r_path = os.path.join(rest_dir, r_f)
        
        with Image.open(o_path) as o_im:
            o_w, o_h = o_im.size
        with Image.open(r_path) as r_im:
            r_w, r_h = r_im.size

        # Form clean display title, e.g. "Upadhyaya Portrait #01"
        pair_num = idx + 1
        title = f"{prefix.capitalize()} Heritage Photo #{pair_num:03d}"
        
        o_thumb = f"assets/thumbs/{prefix}/orig_{pair_num:03d}.jpg"
        r_thumb = f"assets/thumbs/{prefix}/restored_{pair_num:03d}.jpg"
        
        create_thumb(o_path, o_thumb, max_dim=800)
        create_thumb(r_path, r_thumb, max_dim=800)
        
        pairs.append({
            'id': f"{prefix}-{pair_num:03d}",
            'title': title,
            'orig_file': o_f,
            'orig_path': o_path,
            'orig_thumb': o_thumb,
            'orig_width': o_w,
            'orig_height': o_h,
            'orig_aspect': round(o_w / o_h, 3),
            'clear_file': r_f,
            'clear_path': r_path,
            'clear_thumb': r_thumb,
            'clear_width': r_w,
            'clear_height': r_h,
            'clear_aspect': round(r_w / r_h, 3),
            'orientation': 'landscape' if r_w > r_h else ('portrait' if r_h > r_w else 'square'),
            'score': 0.95,
            'is_paired': True
        })

    unpaired = []
    for idx, u_f in enumerate(unrest_files):
        u_path = os.path.join(unrest_dir, u_f)
        with Image.open(u_path) as u_im:
            u_w, u_h = u_im.size
        
        u_num = idx + 1
        u_thumb = f"assets/thumbs/{prefix}/unrestored_{u_num:03d}.jpg"
        create_thumb(u_path, u_thumb, max_dim=800)
        
        unpaired.append({
            'id': f"{prefix}-raw-{u_num:03d}",
            'title': f"{prefix.capitalize()} Raw Original #{u_num:03d}",
            'orig_file': u_f,
            'orig_path': u_path,
            'orig_thumb': u_thumb,
            'orig_width': u_w,
            'orig_height': u_h,
            'orig_aspect': round(u_w / u_h, 3),
            'orientation': 'landscape' if u_w > u_h else ('portrait' if u_h > u_w else 'square'),
            'is_paired': False
        })

    data = {
        'collection': prefix,
        'total_orig': len(orig_files) + len(unpaired),
        'total_clear': len(rest_files),
        'total_paired': len(pairs),
        'total_unpaired': len(unpaired),
        'pairs': pairs,
        'unpaired': unpaired
    }
    
    with open(output_json, 'w', encoding='utf-8') as out:
        json.dump(data, out, indent=2)

    js_file = output_json.replace('.json', '.js')
    var_name = 'DATA_' + prefix.upper()
    with open(js_file, 'w', encoding='utf-8') as out_js:
        out_js.write(f"window.{var_name} = ")
        json.dump(data, out_js, indent=2)
        out_js.write(";\n")

    print(f"Generated {output_json} and {js_file}: {len(pairs)} pairs, {len(unpaired)} unrestored.")
    return data

if __name__ == '__main__':
    # Clean previous thumbs to ensure fresh standardized names
    import shutil
    shutil.rmtree('assets/thumbs', ignore_errors=True)
    os.makedirs('assets/thumbs/upadhyaya', exist_ok=True)
    os.makedirs('assets/thumbs/das', exist_ok=True)
    
    process_organized_collection('upadhyaya', 'data_upadhyaya.json')
    process_organized_collection('das', 'data_das.json')
    print("\nAll datasets and thumbnails generated successfully!")
