# Create SN-ERMS simple Bangla user manual as Word .docx
$ErrorActionPreference = 'Stop'
$outDir = 'C:\Project\saba\samim\docs\nacecary_photos_and_flowers_for_testing'
$outPath = Join-Path $outDir 'SN-ERMS_User_Manual_Bangla.docx'
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

$word = New-Object -ComObject Word.Application
$word.Visible = $false
$doc = $word.Documents.Add()
$sel = $word.Selection

function H1([string]$t) {
  $sel.Style = 'Heading 1'
  $sel.Font.Name = 'Kalpurush'
  if (-not $sel.Font.Name) { $sel.Font.Name = 'Nirmala UI' }
  $sel.Font.Size = 18
  $sel.TypeText($t)
  $sel.TypeParagraph()
  $sel.Style = 'Normal'
  $sel.Font.Name = 'Nirmala UI'
  $sel.Font.Size = 12
}
function H2([string]$t) {
  $sel.Style = 'Heading 2'
  $sel.Font.Name = 'Nirmala UI'
  $sel.Font.Size = 14
  $sel.TypeText($t)
  $sel.TypeParagraph()
  $sel.Style = 'Normal'
  $sel.Font.Name = 'Nirmala UI'
  $sel.Font.Size = 12
}
function P([string]$t) {
  $sel.Font.Name = 'Nirmala UI'
  $sel.Font.Size = 12
  $sel.TypeText($t)
  $sel.TypeParagraph()
}
function Bullet([string]$t) {
  $sel.Range.ListFormat.ApplyBulletDefault()
  $sel.Font.Name = 'Nirmala UI'
  $sel.Font.Size = 12
  $sel.TypeText($t)
  $sel.TypeParagraph()
  $sel.Range.ListFormat.RemoveNumbers()
}

# Title
$sel.ParagraphFormat.Alignment = 1
$sel.Font.Name = 'Nirmala UI'
$sel.Font.Size = 22
$sel.Font.Bold = $true
$sel.TypeText('Saba Nursery ERMS')
$sel.TypeParagraph()
$sel.Font.Size = 16
$sel.TypeText('সম্পূর্ণ ব্যবহারকারী নির্দেশিকা (খুব সহজ ভাষায়)')
$sel.TypeParagraph()
$sel.Font.Size = 11
$sel.Font.Bold = $false
$sel.TypeText('SN-ERMS v3.0 · নার্সারি চালানোর সফটওয়্যার')
$sel.TypeParagraph()
$sel.TypeText(('তারিখ: ' + (Get-Date -Format 'dd MMMM yyyy')))
$sel.TypeParagraph()
$sel.ParagraphFormat.Alignment = 0
$sel.TypeParagraph()

P 'এই বইতে লেখা আছে — কম্পিউটার বা ফোনে অ্যাপ খুলে নার্সারির কাজ কীভাবে করবেন। প্রতিটি ধাপ ছোট ছোট করে লেখা। একটা কাজ শেষ করে পরেরটা করুন।'

H1 '১) অ্যাপ কী?'
P 'Saba Nursery ERMS (সংক্ষেপে SN-ERMS) হলো নার্সারির হিসাব-নিকাশ ও কাজের অ্যাপ।'
Bullet 'মাদার প্ল্যান্ট (বড় গাছ) রাখা'
Bullet 'নতুন চারা তৈরি (Propagation)'
Bullet 'স্টক / বিক্রির গাছ'
Bullet 'কাউন্টারে বিক্রি (POS)'
Bullet 'ক্যামেরা ও বিপদ সতর্কতা'
Bullet 'খরচ, রিপোর্ট, যত্ন কাজ'
P 'সব কিছু এক জায়গায় দেখা যায়। কাগজে লিখে রাখার ঝামেলা কমে।'

H1 '২) কী দিয়ে খুলবেন?'
H2 'কম্পিউটারে'
Bullet 'Chrome বা Edge ব্রাউজার খুলুন।'
Bullet 'ঠিকানা লিখুন: https://localhost:5173'
Bullet 'সার্ভার চালু না থাকলে অ্যাপ খুলবে না — ডেভেলপারকে বলুন API + Frontend চালু করতে।'

H2 'মোবাইল ফোনে'
Bullet 'ফোন ও কম্পিউটার একই Wi‑Fi / হটস্পটে রাখুন।'
Bullet 'কম্পিউটারের IP দিয়ে খুলুন, উদাহরণ: https://10.x.x.x:5173'
Bullet 'সার্টিফিকেট সতর্কতা এলে Advanced → Continue / Proceed চাপুন।'
Bullet 'অ্যাড্রেস বার লুকাতে চাইলে: Share → Add to Home Screen → হোম থেকে Saba ERMS খুলুন।'

H1 '৩) লগইন (ঢোকা)'
P 'প্রথম পাতায় ইমেইল ও পাসওয়ার্ড দিতে হবে।'
Bullet 'ইমেইল বক্সে আপনার ইমেইল লিখুন।'
Bullet 'পাসওয়ার্ড বক্সে পাসওয়ার্ড লিখুন।'
Bullet 'চোখের আইকন চাপলে পাসওয়ার্ড দেখা যায়।'
Bullet 'Sign in / লগইন বোতাম চাপুন।'
P 'ভুল হলে লাল মেসেজ আসবে — আবার চেষ্টা করুন। সঠিক হলে ভেতরের পাতা খুলবে।'
P 'টেস্ট অ্যাকাউন্ট (ডেমো):'
Bullet 'admin@sabanursery.com  /  Admin@12345   (সব দেখতে পারে — সুপার অ্যাডমিন)'
Bullet 'manager@sabanursery.com  /  Manager@123'
Bullet 'staff@sabanursery.com  /  Staff@123'
Bullet 'cashier@sabanursery.com  /  Cashier@123'
P 'লগআউট: উপরের ডান দিকে দরজার আইকন (Logout) চাপুন।'

H1 '৪) স্ক্রিনের উপরের অংশ (হেডার)'
Bullet 'মেনু (তিন দাগ): চাপলে বাম পাশের মেনু খোলে (মোবাইলে)।'
Bullet 'পিছনে ← ও সামনে → : আগের/পরের পাতায় যায় (আইফোন অ্যাপের মতো)।'
Bullet 'লগইন/হোম পেজে ব্যাক দুইবার চাপলে জিজ্ঞেস করবে — অ্যাপ থেকে বের হবেন কি না।'
Bullet 'ভাষা: পতাকা/ভাষা বোতাম — বাংলা বা ইংরেজি বাছুন।'
Bullet 'অক্ষর বড়/ছোট ও থিম: A আইকন থেকে।'

H1 '৫) বাম পাশের মেনু — কোনটা কী?'
P 'মেনুতে শুধু আপনার অনুমতি আছে এমন মেনু দেখাবে। না দেখলে সেই কাজ আপনার রোলে নেই।'
Bullet 'Dashboard / ড্যাশবোর্ড — আজকের সারাংশ।'
Bullet 'My nursery / আমার নার্সারি — জায়গা (Place), ঠিকানা।'
Bullet 'Mother Plants — বড় মাদার গাছ।'
Bullet 'Propagation Hub — চারা তৈরির ব্যাচ।'
Bullet 'Plant Inventory — বিক্রির স্টক।'
Bullet 'Sales POS — কাউন্টারে বিক্রি।'
Bullet 'Vermicompost — কেঁচো সার / বেড।'
Bullet 'Care — গাছের যত্নের কাজ।'
Bullet 'Distribution — বুকিং / পরিবহন।'
Bullet 'Accounts / Reports — টাকা ও লাভ-ক্ষতি।'
Bullet 'Admin — ইউজার ও সেটিং।'
Bullet 'Danger alerts — বিপদ অ্যালার্ট কেস।'
Bullet 'Voice desk — মুখে প্রশ্ন।'
Bullet 'Treatment — ওষুধ/স্প্রে রেকর্ড।'
Bullet 'Identify plant — পাতার ছবি দিয়ে গাছ চেনা।'
Bullet 'Nurseries (শুধু প্ল্যাটফর্ম ওনার) — নতুন নার্সারি যোগ।'
Bullet 'Live ক্যামেরা — নিচের/কোণার লাইভ বোতাম।'

H1 '৬) ড্যাশবোর্ড'
P 'লগইনের পর সাধারণত এখানে আসবেন। এখানে সংখ্যা দেখা যায় — কত স্টক, কত বিক্রি ইত্যাদি। শুধু দেখুন। কাজ করতে বাম মেনু থেকে অন্য পাতায় যান।'

H1 '৭) আমার নার্সারি (Place)'
Bullet 'মেনু → My nursery।'
Bullet 'এখানে নার্সারির জায়গা (Place / ফিল্ড) যোগ বা দেখা যায়।'
Bullet 'ঠিকানা সেভ করুন যাতে ক্যামেরা ও স্টক জায়গা অনুযায়ী থাকে।'
P 'মনে রাখবেন: পরে ক্যামেরা ও স্টক “কোন Place”-এ আছে সেটা এখান থেকে আসে।'

H1 '৮) Mother Plants (মাদার গাছ)'
P 'এখানে নার্সারির মূল গাছের তালিকা।'
H2 'নতুন মাদার গাছ যোগ'
Bullet 'Add / নতুন বোতাম চাপুন।'
Bullet 'ট্যাগ নম্বর, জাতের নাম, লোকেশন লিখুন।'
Bullet 'ছবি যোগ করতে চাইলে: Choose file / ক্যামেরা — ছবি বেছে নিন।'
Bullet 'ভিডিও থাকলে আলাদা করে ভিডিও আপলোড করুন (বড় ফাইল সময় নেয়)।'
Bullet 'Save চাপুন।'
H2 'ডেমো ছবি কোথায়?'
P 'কম্পিউটারে এই ফোল্ডার খুলুন:'
P 'docs\nacecary_photos_and_flowers_for_testing\05_mother_plants'
Bullet 'ছবি: .jpg ফাইল'
Bullet 'ভিডিও: mother_demo.mp4'

H1 '৯) Propagation (চারা তৈরি)'
Bullet 'মেনু → Propagation Hub।'
Bullet 'নতুন ব্যাচ তৈরি করুন — কোন মাদার থেকে, কতটা কাটিং, কোন ধাপ।'
Bullet 'লেবেল/QR প্রিন্ট করতে পারলে ট্যাগ দেখুন।'
Bullet 'ডেমো মিডিয়া: 06_propagation ফোল্ডার (batch_demo.mp4)।'

H1 '১০) Inventory (স্টক)'
Bullet 'মেনু → Plant Inventory।'
Bullet 'বিক্রির জন্য প্রস্তুত গাছ এখানে।'
Bullet 'স্ক্যান/কোড দিয়ে খুঁজতে পারেন।'
Bullet 'স্টক ছবি/ভিডিও: 07_inventory_stock ফোল্ডার।'
P 'স্টক কমে গেলে বিক্রি হবে না — আগে স্টক ঠিক আছে কি না দেখুন।'

H1 '১১) Sales POS (কাউন্টার বিক্রি)'
Bullet 'মেনু → Sales POS।'
Bullet 'গাছ স্ক্যান বা বেছে নিন → কার্টে যোগ।'
Bullet 'দাম ও পরিমাণ চেক করুন।'
Bullet 'পেমেন্ট শেষে সেল সম্পন্ন করুন।'
Bullet 'মার্কেটিং ছবি/ভিডিও লাগলে: 08_pos_marketing ফোল্ডার।'
P 'সতর্কতা: ভুল বিক্রি সেভ হলে স্টক ভুল হবে — সেভের আগে দুইবার দেখুন।'

H1 '১২) Vermicompost'
Bullet 'মেনু → Vermicompost।'
Bullet 'বেড যোগ করুন, আর্দ্রতা/অবস্থা লিখুন।'
Bullet 'ছবি: 11_vermicompost ফোল্ডার।'

H1 '১৩) Care (যত্ন)'
Bullet 'মেনু → Care।'
Bullet 'কোন গাছে কী কাজ করতে হবে লিখুন।'
Bullet 'কাজ শেষ হলে Done / সম্পন্ন চাপুন।'
Bullet 'ছবি/ভিডিও: 12_care_field।'

H1 '১৪) Distribution'
Bullet 'বুকিং, পরিবহন ম্যানিফেস্ট, লিড — এখানে।'
Bullet 'নতুন বুকিং → গন্তব্য ও মালের সারাংশ লিখে সেভ।'

H1 '১৫) Accounts / Reports'
Bullet 'মেনু → Accounts।'
Bullet 'আয়-ব্যয় ও লাভের হিসাব দেখা যায়।'
Bullet 'খরচ যোগ করতে খরচের ফর্ম পূরণ করে সেভ করুন।'
P 'শুধু ম্যানেজার/অ্যাডমিন দেখতে পারে।'

H1 '১৬) Admin'
Bullet 'নার্সারির ইউজার তৈরি, রোল (Admin/Manager/Staff/Cashier)।'
Bullet 'নতুন কর্মীকে ইমেইল+পাসওয়ার্ড দিন — তারা লগইন করতে পারবে।'

H1 '১৭) Danger alerts (বিপদ সতর্কতা)'
P 'লাইভ ক্যামেরায় কেউ/কিছু ধরা পড়লে অ্যালার্ম বাজে। Stop alert চাপলে ছবি/ভিডিও সহ কেস সেভ হয়।'
Bullet 'মেনু → Danger alerts — সব কেস দেখুন।'
Bullet 'নার্সারি ও Place ফিল্টার দিয়ে খুঁজুন।'
Bullet 'Photo / Video বোতামে প্রমাণ বড় করে দেখা যায়।'
Bullet 'Share দিয়ে কেস লিঙ্ক পাঠানো যায়।'
Bullet 'ডেমো ছবি/ভিডিও: 09_alerts_danger।'
P 'শুধু সাইরেন বাজা = কেস হয় না। Stop alert (বা ৩০ সেকেন্ড শেষ) + প্রমাণ আপলোড হলে কেস আসে।'

H1 '১৮) Live ক্যামেরা'
Bullet 'স্ক্রিনে লাইভ/ক্যামেরা বোতাম খুলুন।'
Bullet 'Place বেছে ক্যামেরা Start করুন (এক ফোনে এক ক্যামেরা)।'
Bullet 'ডিটেকশন চালু থাকলে মানুষ/প্রাণী দেখলে কণ্ঠ + অ্যালার্ট বাজে।'
Bullet 'Stop alert চাপলে Danger alerts-এ কেস যায়।'
Bullet 'দৃশ্যের ডেমো ছবি: 13_live_camera।'

H1 '১৯) Voice desk'
Bullet 'মেনু → Voice desk।'
Bullet 'লিখুন বা মাইকে বলুন — যেমন: “পেয়ারা কত স্টক?”'
Bullet 'উত্তর স্ক্রিনে দেখাবে।'

H1 '২০) Treatment ও Identify plant'
Bullet 'Treatment: কোন গাছে কী ওষুধ/স্প্রে — লিখে সেভ, পরে Done।'
Bullet 'Identify plant: পাতার ছবি তুলুন (10_plant_id_leaves ফোল্ডারের ছবি দিয়ে অনুশীলন), আকার/কিনারা মিলিয়ে নাম পাবেন।'

H1 '২১) Nurseries (শুধু প্ল্যাটফর্ম মালিক)'
Bullet 'নতুন নার্সারি অনবোর্ড, প্ল্যান/ফিচার চালু-বন্ধ।'
Bullet 'সাধারণ স্টাফ এই মেনু দেখবে না।'

H1 '২২) ডেমো ছবি-ভিডিও ফোল্ডার ম্যাপ'
P 'সব ফাইল এখানে:'
P 'C:\Project\saba\samim\docs\nacecary_photos_and_flowers_for_testing'
Bullet '01_fruits — ফল'
Bullet '02_flowers — ফুল'
Bullet '03_indoor_plants — ঘরের গাছ'
Bullet '04_outdoor_plants — বাইরের গাছ'
Bullet '05_mother_plants — মাদার প্ল্যান্ট আপলোড'
Bullet '06_propagation — প্রোপাগেশন'
Bullet '07_inventory_stock — স্টক'
Bullet '08_pos_marketing — POS মার্কেটিং'
Bullet '09_alerts_danger — অ্যালার্ট প্রমাণ'
Bullet '10_plant_id_leaves — পাতা চেনা'
Bullet '11_vermicompost — কেঁচো সার'
Bullet '12_care_field — যত্ন'
Bullet '13_live_camera — লাইভ দৃশ্য'
Bullet '14_videos — সব ভিডিও একসাথে'
P 'প্রতি ফোল্ডারে *_demo.mp4 থাকলে সেটা দিয়ে ভিডিও আপলোড ডেমো করুন।'

H1 '২৩) সমস্যা হলে কী করবেন?'
Bullet 'পাতা খুলছে না → সার্ভার চালু আছে কি? একই Wi‑Fi তে আছেন কি?'
Bullet 'লগইন হচ্ছে না → ইমেইল/পাসওয়ার্ড ঠিক আছে? Caps Lock বন্ধ?'
Bullet 'ছবি উঠছে না → ফাইল খুব বড় তো নয়? JPG/PNG ব্যবহার করুন।'
Bullet 'ক্যামেরা খুলছে না → ব্রাউজারে ক্যামেরার অনুমতি দিন। HTTPS দিয়ে খুলুন।'
Bullet 'অ্যালার্ট লিস্টে কেস নেই → Stop alert চেপেছেন? নার্সারি ফিল্টার “সব” আছে?'
Bullet 'স্টক ভুল → POS সেল ও ইনভেন্টরি আবার চেক করুন; ভুল সেল করবেন না।'

H1 '২৪) সহজ নিয়ম (মনে রাখুন)'
Bullet 'এক কাজ → এক পাতা → সেভ চাপুন।'
Bullet 'সেভের আগে নাম, সংখ্যা, দাম দুইবার দেখুন।'
Bullet 'লাইভ নার্সারিতে স্টক/দাম/লগইন নিয়ে খেলা করবেন না।'
Bullet 'বের হতে হলে Logout চাপুন।'
Bullet 'বুঝতে না পারলে সহকর্মী বা অ্যাডমিনকে দেখান — এই ম্যানুয়াল হাতে রেখে।'

$sel.TypeParagraph()
P '— শেষ —'
P 'Saba Nursery · SN-ERMS · সহজ ব্যবহারকারী নির্দেশিকা'

# Prefer Kalpurush/Nikosh if present else Nirmala UI for whole body
try {
  $doc.Content.Font.Name = 'Nirmala UI'
} catch {}

# Save as docx (16 = wdFormatXMLDocument)
if (Test-Path $outPath) { Remove-Item $outPath -Force }
$wdFormatXMLDocument = 16
$doc.SaveAs([ref]$outPath, [ref]$wdFormatXMLDocument)
$doc.Close()
$word.Quit()
[System.Runtime.Interopservices.Marshal]::ReleaseComObject($sel) | Out-Null
[System.Runtime.Interopservices.Marshal]::ReleaseComObject($doc) | Out-Null
[System.Runtime.Interopservices.Marshal]::ReleaseComObject($word) | Out-Null
[GC]::Collect()
[GC]::WaitForPendingFinalizers()

Write-Host "OK $outPath"
Write-Host "Size KB:" ([math]::Round((Get-Item $outPath).Length/1KB))
