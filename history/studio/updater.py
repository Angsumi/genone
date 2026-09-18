import os
import json
import re
from PIL import Image, ImageOps

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def create_thumb(src_path, dest_path, max_dim=800):
    os.makedirs(os.path.dirname(dest_path), exist_ok=True)
    try:
        with Image.open(src_path) as im:
            im = ImageOps.exif_transpose(im)
            im.thumbnail((max_dim, max_dim), Image.Resampling.LANCZOS)
            if im.mode in ('RGBA', 'P'):
                im = im.convert('RGB')
            im.save(dest_path, 'JPEG', quality=82, optimize=True)
    except Exception as e:
        print(f"Error creating thumbnail for {src_path}: {e}")

def rebuild_all_datasets():
    """Rebuilds datasets and updates all website files."""
    stats = {}
    
    for prefix in ['upadhyaya', 'das']:
        c_base = os.path.join(BASE_DIR, 'collections', prefix)
        orig_dir = os.path.join(c_base, 'original')
        rest_dir = os.path.join(c_base, 'restored')
        unrest_dir = os.path.join(c_base, 'unrestored')
        
        orig_files = sorted(os.listdir(orig_dir)) if os.path.exists(orig_dir) else []
        rest_files = sorted(os.listdir(rest_dir)) if os.path.exists(rest_dir) else []
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
            
            # Ensure thumbnail exists
            if not os.path.exists(os.path.join(BASE_DIR, o_thumb)):
                create_thumb(o_path, os.path.join(BASE_DIR, o_thumb), max_dim=800)
            if not os.path.exists(os.path.join(BASE_DIR, r_thumb)):
                create_thumb(r_path, os.path.join(BASE_DIR, r_thumb), max_dim=800)
                
            pairs.append({
                'id': pair_id,
                'title': title,
                'orig_file': o_f,
                'orig_path': os.path.relpath(o_path, BASE_DIR),
                'orig_thumb': o_thumb,
                'orig_width': o_w,
                'orig_height': o_h,
                'orig_aspect': round(o_w / o_h, 3),
                'clear_file': r_f,
                'clear_path': os.path.relpath(r_path, BASE_DIR),
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
            
        # Keep featured landmark at the top
        if prefix == 'upadhyaya':
            u_feats = [p for p in pairs if p['id'] == 'upadhyaya-019']
            if u_feats:
                pairs.remove(u_feats[0])
                pairs.insert(0, u_feats[0])
        elif prefix == 'das':
            d_feats = [p for p in pairs if p['id'] == 'das-046']
            if d_feats:
                pairs.remove(d_feats[0])
                pairs.insert(0, d_feats[0])
                
        # Unpaired unrestored items
        unpaired = []
        for idx, u_f in enumerate(unrest_files):
            u_path = os.path.join(unrest_dir, u_f)
            with Image.open(u_path) as u_im:
                u_w, u_h = u_im.size
                
            u_num = idx + 1
            u_thumb = f"assets/thumbs/{prefix}/unrestored_{u_num:03d}.jpg"
            if not os.path.exists(os.path.join(BASE_DIR, u_thumb)):
                create_thumb(u_path, os.path.join(BASE_DIR, u_thumb), max_dim=800)
                
            unpaired.append({
                'id': f"{prefix}-raw-{u_num:03d}",
                'title': f"{prefix.capitalize()} Original #{u_num:03d} (Still Needs to be Restored)",
                'orig_file': u_f,
                'orig_path': os.path.relpath(u_path, BASE_DIR),
                'orig_thumb': u_thumb,
                'orig_width': u_w,
                'orig_height': u_h,
                'orig_aspect': round(u_w / u_h, 3),
                'orientation': 'landscape' if u_w > u_h else ('portrait' if u_h > u_w else 'square'),
                'is_paired': False,
                'needs_restoration': True,
                'featured_tag': 'Needs Restoration'
            })
            
        total_unique = len(pairs) + len(unpaired)
        rate = round((len(pairs) / total_unique * 100)) if total_unique > 0 else 0
        
        stats[prefix] = {
            'total': total_unique,
            'paired': len(pairs),
            'unpaired': len(unpaired),
            'rate': rate
        }
        
        data = {
            'collection': prefix,
            'total_orig': total_unique,
            'total_clear': len(pairs),
            'total_paired': len(pairs),
            'total_unpaired': len(unpaired),
            'pairs': pairs,
            'unpaired': unpaired
        }
        
        out_json = os.path.join(BASE_DIR, f'data_{prefix}.json')
        out_js = os.path.join(BASE_DIR, f'data_{prefix}.js')
        
        with open(out_json, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2)
            
        with open(out_js, 'w', encoding='utf-8') as f:
            f.write(f"window.DATA_{prefix.upper()} = " + json.dumps(data, indent=2) + ";\n")
            
    sync_html_stats(stats)
    return stats

def sync_html_stats(stats):
    """Synchronizes stat numbers on HTML pages."""
    up = stats.get('upadhyaya', {'total': 42, 'paired': 40, 'unpaired': 2, 'rate': 95})
    das = stats.get('das', {'total': 210, 'paired': 129, 'unpaired': 81, 'rate': 61})
    grand_total = up['total'] + das['total']
    grand_paired = up['paired'] + das['paired']
    
    # 1. upadhyaya.html
    up_path = os.path.join(BASE_DIR, 'upadhyaya.html')
    if os.path.exists(up_path):
        with open(up_path, 'r', encoding='utf-8') as f:
            content = f.read()
        content = re.sub(r'id="stat-total-orig">\d+<', f'id="stat-total-orig">{up["total"]}<', content)
        content = re.sub(r'id="stat-total-paired">\d+<', f'id="stat-total-paired">{up["paired"]}<', content)
        content = re.sub(r'id="stat-total-unpaired">\d+<', f'id="stat-total-unpaired">{up["unpaired"]}<', content)
        content = re.sub(r'id="stat-rate">\d+%<', f'id="stat-rate">{up["rate"]}%<', content)
        with open(up_path, 'w', encoding='utf-8') as f:
            f.write(content)
            
    # 2. das.html
    das_path = os.path.join(BASE_DIR, 'das.html')
    if os.path.exists(das_path):
        with open(das_path, 'r', encoding='utf-8') as f:
            content = f.read()
        content = re.sub(r'id="stat-total-orig">\d+<', f'id="stat-total-orig">{das["total"]}<', content)
        content = re.sub(r'id="stat-total-paired">\d+<', f'id="stat-total-paired">{das["paired"]}<', content)
        content = re.sub(r'id="stat-total-unpaired">\d+<', f'id="stat-total-unpaired">{das["unpaired"]}<', content)
        content = re.sub(r'id="stat-rate">\d+%<', f'id="stat-rate">{das["rate"]}%<', content)
        with open(das_path, 'w', encoding='utf-8') as f:
            f.write(content)
            
    # 3. index.html
    index_path = os.path.join(BASE_DIR, 'index.html')
    if os.path.exists(index_path):
        with open(index_path, 'r', encoding='utf-8') as f:
            content = f.read()
        # Hero total photos
        content = re.sub(r'<div class="stat-num">\d+</div>\s*<div class="stat-meta">\s*<div class="stat-title">Original Photographs</div>',
                         f'<div class="stat-num">{grand_total}</div>\n        <div class="stat-meta">\n          <div class="stat-title">Original Photographs</div>', content)
        # Hero restored pairs
        content = re.sub(r'<div class="stat-num">\d+</div>\s*<div class="stat-meta">\s*<div class="stat-title">Restored Pairs</div>',
                         f'<div class="stat-num">{grand_paired}</div>\n        <div class="stat-meta">\n          <div class="stat-title">Restored Pairs</div>', content)
        # Step 1 roadmap description
        content = re.sub(r'Digitized and restored \d+ photographs', f'Digitized and restored {grand_total} photographs', content)
        with open(index_path, 'w', encoding='utf-8') as f:
            f.write(content)
