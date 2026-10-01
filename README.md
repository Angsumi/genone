# GenOne

A modern web portal and heritage archive designed for the **GenOne** youth organization. This repository hosts the frontend codebase showcasing organization committee members, mission, activities, news publications, and digital historical archives.

---

## 🌐 Live Websites & Quick Links

| Platform / Service | Direct Link | Description |
| :--- | :--- | :--- |
| 🏛️ **GenOne Official Portal** | [angsumi.github.io/genone](https://angsumi.github.io/genone/) | Main landing page & committee member directory |
| 📜 **Rangachakua History (Live App)** | [rangachakua.web.app](https://rangachakua.web.app) | Official live history archive & photo contribution webapp |
| 📂 **History Archive (GitHub Pages Mirror)** | [angsumi.github.io/genone/history](https://angsumi.github.io/genone/history/) | Static photo & document collection viewer |
| 🖼️ **Photo Gallery** | [angsumi.github.io/genone/gallery.html](https://angsumi.github.io/genone/gallery.html) | Community events, celebrations & milestones |
| 📰 **News & Press Coverage** | [angsumi.github.io/genone/news.html](https://angsumi.github.io/genone/news.html) | Newspaper clippings, reports & press releases |
| 🗺️ **Naduar Interactive Map** | [angsumi.github.io/map/naduar](https://angsumi.github.io/map/naduar/) | Regional geographic & village boundary guide |
| 📝 **ADRE Mock Test Portal** | [angsumi.github.io/ADRE](https://angsumi.github.io/ADRE/) | Free educational mock test portal for students |

### 📱 Official Social Channels
- **Instagram:** [@genone__official](https://www.instagram.com/genone__official/)
- **Facebook:** [GenOne Facebook Page](https://www.facebook.com/profile.php?id=61593255946763)

---

## 🌟 Features & Modules

### 1. 🏛️ Main Web Portal
- **Committee Showcase:** Dedicated interactive section displaying profiles of core committee members with dynamic image rendering.
- **News & Media Coverage:** Dedicated press coverage hub (`news.html`) featuring publications and news articles.
- **Photo Gallery:** Curated photo gallery (`gallery.html`) covering community events, activities, and milestones.
- **Responsive & Lightweight:** Built with modern, clean HTML5/CSS3/JavaScript for fast loading on desktop and mobile devices.

### 2. 📜 Rangachakua History Archive (`history/`)
> 🚀 **Live Production Application:** [https://rangachakua.web.app](https://rangachakua.web.app)

A dedicated digital preservation portal documenting regional lineage, historical photographs, and heritage collections:
- **Live Community Photo Webapp (`history/webapp/`):** Full-featured application deployed at [rangachakua.web.app](https://rangachakua.web.app) allowing community members to contribute and explore historical photos with client-side image optimization, Firebase Firestore integration, and lightbox preview.
- **Heritage Portals:** Specialized archive viewers for family collections (`das.html`, `upadhyaya.html`, and `index.html`).
- **Studio & Data Pipelines (`history/studio/`, `history/scripts/`):** Python-based tools and scripts for metadata tagging, deduplication, and JSON/JS dataset generation.
- **Firebase Configuration:** Configured with `firebase.json` and `firestore.rules` for automated hosting and secured database rules.

---

## 📁 Repository Structure

```text
GenOne/
├── assets/
│   └── images/
│       ├── brand/              # Logos and brand graphics
│       ├── committee/          # Committee member profile photos
│       ├── gallery/            # Community and event photo gallery
│       └── news/               # Press clippings and news article images
├── data/
│   └── final_committee_contacts.csv # Committee member contact records
├── history/                    # Rangachakua History Archive module (rangachakua.web.app)
│   ├── index.html              # History archive homepage
│   ├── das.html                # Das heritage collection
│   ├── upadhyaya.html          # Upadhyaya heritage collection
│   ├── webapp/                 # Community photo contribution web application
│   │   ├── index.html
│   │   ├── css/
│   │   └── js/
│   ├── collections/            # Archival photo collections
│   ├── studio/                 # Archive curation & metadata studio (Python)
│   ├── scripts/                # Data processing & sync scripts
│   ├── firebase.json           # Firebase Hosting & Firestore configuration
│   └── firestore.rules         # Cloud Firestore security rules
├── index.html                  # Main portal landing page
├── gallery.html                # Event & community photo gallery
├── news.html                   # News articles & press releases
└── README.md
```

---

## 🛠️ Tech Stack
- **Frontend:** HTML5, CSS3, JavaScript (ES6+ Modules)
- **Backend & Database:** Firebase Firestore, Firebase Hosting (`rangachakua.web.app`)
- **Image Processing & Storage:** HTML5 Canvas image compression, ImgBB API
- **Data Management:** CSV, JSON
- **Automation / Utilities:** Python 3 (Flask, PIL)

---

## 🚀 Getting Started

### Local Development (Static Pages)
1. Clone this repository:
   ```bash
   git clone https://github.com/Angsumi/genone.git
   cd genone
   ```
2. Start a local HTTP server:
   ```bash
   python3 -m http.server 8000
   ```
3. Open `http://localhost:8000` in your web browser.

### History Webapp & Studio
- **Live URL:** Visit [https://rangachakua.web.app](https://rangachakua.web.app)
- **Local History Webapp:** Open `http://localhost:8000/history/webapp/` or `http://localhost:8000/history/`
- **Run History Studio locally:**
  ```bash
  cd history
  ./run_studio.sh
  ```

---

## 📖 About
**GenOne** is dedicated to youth empowerment, cultural preservation, and community building. This portal acts as the digital front door and historical preservation hub for the organization and its community.
