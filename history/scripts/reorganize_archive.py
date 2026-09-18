import os
import shutil
import hashlib
import json
from PIL import Image, ImageOps

def get_md5(filepath):
    h = hashlib.md5()
    with open(filepath, 'rb') as f:
        while chunk := f.read(8192):
            h.update(chunk)
    return h.hexdigest()

def reorganize():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    collections_dir = os.path.join(base_dir, 'collections')
    os.makedirs(collections_dir, exist_ok=True)
    
    # 1. Process Upadhyaya
    print("=== Reorganizing Upadhyaya Collection ===")
    upadhyaya_dir = os.path.join(collections_dir, 'upadhyaya')
    u_orig_dest = os.path.join(upadhyaya_dir, 'original')
    u_rest_dest = os.path.join(upadhyaya_dir, 'restored')
    u_unrest_dest = os.path.join(upadhyaya_dir, 'unrestored')
    for d in [u_orig_dest, u_rest_dest, u_unrest_dest]:
        os.makedirs(d, exist_ok=True)

    with open(os.path.join(base_dir, 'data_upadhyaya.json')) as f:
        u_data = json.load(f)

    u_provenance = []
    seen_hashes = set()
    pair_idx = 1

    for p in u_data['pairs']:
        clear_src = os.path.join(base_dir, p['clear_path'])
        if not os.path.exists(clear_src):
            continue
        c_hash = get_md5(clear_src)
        if c_hash in seen_hashes:
            # Duplicate file - record in provenance as skipped duplicate
            u_provenance.append({
                'action': 'skipped_duplicate',
                'old_clear_file': p['clear_file'],
                'md5': c_hash,
                'matched_orig': p['orig_file']
            })
            continue
        seen_hashes.add(c_hash)

        # Standardized names
        new_orig_name = f"upadhyaya_{pair_idx:03d}_orig.jpg"
        new_rest_name = f"upadhyaya_{pair_idx:03d}_restored.png"

        orig_src = os.path.join(base_dir, p['orig_path'])
        orig_target = os.path.join(u_orig_dest, new_orig_name)
        rest_target = os.path.join(u_rest_dest, new_rest_name)

        # Save original (with rotation if needed)
        with Image.open(orig_src) as im:
            im = ImageOps.exif_transpose(im)
            rot = p.get('orig_rot', 0)
            if rot != 0:
                im = im.rotate(rot, expand=True)
            if im.mode in ('RGBA', 'P'):
                im = im.convert('RGB')
            im.save(orig_target, 'JPEG', quality=95)

        # Copy restored
        shutil.copy2(clear_src, rest_target)

        u_provenance.append({
            'action': 'paired',
            'pair_id': f"upadhyaya-{pair_idx:03d}",
            'new_orig': f"collections/upadhyaya/original/{new_orig_name}",
            'new_restored': f"collections/upadhyaya/restored/{new_rest_name}",
            'old_orig': p['orig_file'],
            'old_restored': p['clear_file'],
            'orig_rotation': p.get('orig_rot', 0),
            'score': p.get('score', 0),
            'md5': c_hash
        })
        pair_idx += 1

    # Unrestored Upadhyaya originals
    unrest_idx = 1
    for item in u_data.get('unpaired', []):
        src = os.path.join(base_dir, item['orig_path'])
        if not os.path.exists(src):
            continue
        new_name = f"upadhyaya_raw_{unrest_idx:03d}.jpg"
        target = os.path.join(u_unrest_dest, new_name)
        shutil.copy2(src, target)
        u_provenance.append({
            'action': 'unrestored',
            'new_file': f"collections/upadhyaya/unrestored/{new_name}",
            'old_orig': item['orig_file']
        })
        unrest_idx += 1

    with open(os.path.join(upadhyaya_dir, 'provenance_map.json'), 'w', encoding='utf-8') as f:
        json.dump(u_provenance, f, indent=2)

    print(f"Upadhyaya: Created {pair_idx - 1} unique pairs and {unrest_idx - 1} unrestored originals.")


    # 2. Process Das
    print("\n=== Reorganizing Das Collection ===")
    das_dir = os.path.join(collections_dir, 'das')
    d_orig_dest = os.path.join(das_dir, 'original')
    d_rest_dest = os.path.join(das_dir, 'restored')
    d_unrest_dest = os.path.join(das_dir, 'unrestored')
    for d in [d_orig_dest, d_rest_dest, d_unrest_dest]:
        os.makedirs(d, exist_ok=True)

    with open(os.path.join(base_dir, 'data_das.json')) as f:
        d_data = json.load(f)

    d_provenance = []
    d_pair_idx = 1

    for p in d_data['pairs']:
        clear_src = os.path.join(base_dir, p['clear_path'])
        orig_src = os.path.join(base_dir, p['orig_path'])
        if not os.path.exists(clear_src) or not os.path.exists(orig_src):
            continue

        new_orig_name = f"das_{d_pair_idx:03d}_orig.jpg"
        new_rest_name = f"das_{d_pair_idx:03d}_restored.png"

        orig_target = os.path.join(d_orig_dest, new_orig_name)
        rest_target = os.path.join(d_rest_dest, new_rest_name)

        # Save original (with rotation if needed)
        with Image.open(orig_src) as im:
            im = ImageOps.exif_transpose(im)
            rot = p.get('orig_rot', 0)
            if rot != 0:
                im = im.rotate(rot, expand=True)
            if im.mode in ('RGBA', 'P'):
                im = im.convert('RGB')
            im.save(orig_target, 'JPEG', quality=95)

        # Copy restored
        shutil.copy2(clear_src, rest_target)

        d_provenance.append({
            'action': 'paired',
            'pair_id': f"das-{d_pair_idx:03d}",
            'new_orig': f"collections/das/original/{new_orig_name}",
            'new_restored': f"collections/das/restored/{new_rest_name}",
            'old_orig': p['orig_file'],
            'old_restored': p['clear_file'],
            'orig_rotation': p.get('orig_rot', 0),
            'score': p.get('score', 0)
        })
        d_pair_idx += 1

    # Unrestored Das originals
    d_unrest_idx = 1
    for item in d_data.get('unpaired', []):
        src = os.path.join(base_dir, item['orig_path'])
        if not os.path.exists(src):
            continue
        new_name = f"das_raw_{d_unrest_idx:03d}.jpg"
        target = os.path.join(d_unrest_dest, new_name)
        shutil.copy2(src, target)
        d_provenance.append({
            'action': 'unrestored',
            'new_file': f"collections/das/unrestored/{new_name}",
            'old_orig': item['orig_file']
        })
        d_unrest_idx += 1

    with open(os.path.join(das_dir, 'provenance_map.json'), 'w', encoding='utf-8') as f:
        json.dump(d_provenance, f, indent=2)

    print(f"Das: Created {d_pair_idx - 1} unique pairs and {d_unrest_idx - 1} unrestored originals.")
    print("\nReorganization copy completed successfully!")

if __name__ == '__main__':
    reorganize()
