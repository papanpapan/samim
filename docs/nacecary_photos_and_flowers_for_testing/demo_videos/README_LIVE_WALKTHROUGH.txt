SN-ERMS LIVE walkthrough videos (real UI + mouse cursor + Edge voice)
=======================================================================
Folder (absolute):
  C:\Project\saba\samim\docs\nacecary_photos_and_flowers_for_testing\demo_videos

Files:
  SN-ERMS_Live_Walkthrough_English.mp4  — English voice (Neerja)
  SN-ERMS_Live_Walkthrough_Bangla.mp4   — বাংলা voice (Tanishaa)
  SN-ERMS_Live_Walkthrough_Hindi.mp4    — हिन्दी voice (Swara)
  SN-ERMS_Live_Walkthrough_Silent.webm  — silent live UI capture (source)

Length: about 5–8 minutes each (matches narration).

Rebuild:
  1) Start backend + client (npm run dev in both)
  2) node docs/record-live-walkthrough.mjs
  3) node docs/build-live-walkthrough-videos.mjs
