/**
 * School Panel Guide – the "how to use the School Panel" book opened from the
 * eye icon on the School Panel dashboard (see app/school/PanelGuide.tsx).
 *
 * Every block is written once in both languages, [English, Hindi], so the two
 * editions always have the same blocks in the same order. That lets the book
 * keep the reader on the same section when they switch language.
 *
 * Not internal: it only describes the panel's own screens, so it is bundled
 * with the page rather than served from an API.
 *
 * Inline markup in text: <b>…</b>, <i>…</i>, <mark>…</mark>. Button and screen
 * names stay in English in both editions because that is what the panel shows.
 */

import type { Handbook, HandbookBlock } from './moderator-handbook';

export type GuideLang = 'en' | 'hi';
type Bi = [en: string, hi: string];

type GuideBlock =
  | { k: 'chapter'; n?: number; title: Bi; subtitle?: Bi; newPage?: boolean }
  | { k: 'heading'; text: Bi }
  | { k: 'p'; text: Bi; indent?: 0 | 1 | 2 }
  | { k: 'table'; head: Bi[]; rows: Bi[][]; cols?: string[] }
  | { k: 'template'; title: Bi; lines: Bi[] };

const ch = (n: number | undefined, title: Bi, subtitle?: Bi): GuideBlock => ({ k: 'chapter', n, title, subtitle, newPage: true });
const h = (en: string, hi: string): GuideBlock => ({ k: 'heading', text: [en, hi] });
const p = (en: string, hi: string): GuideBlock => ({ k: 'p', text: [en, hi] });
/** A point under a lead-in line. */
const li = (en: string, hi: string): GuideBlock => ({ k: 'p', text: [en, hi], indent: 1 });
/** A boxed card: numbered steps, a tip, or a warning. */
const box = (title: Bi, lines: Bi[]): GuideBlock => ({ k: 'template', title, lines });
const table = (head: Bi[], rows: Bi[][], cols?: string[]): GuideBlock => ({ k: 'table', head, rows, cols });

const STATUS_COLS = ['28%', '72%'];

const BLOCKS: GuideBlock[] = [
  /* 1 ─ Welcome */
  ch(1, ['Welcome to your School Panel', 'आपके School Panel में स्वागत है'], ['How to use this book', 'यह किताब कैसे पढ़ें']),
  p('This book explains every screen and every button of the Mittmee School Panel in simple words. Read it once from start to end, or jump straight to the part you need from the <b>Contents</b> page.',
    'यह किताब Mittmee School Panel की हर स्क्रीन और हर बटन को आसान भाषा में समझाती है। इसे एक बार शुरू से आखिर तक पढ़ें, या <b>विषय-सूची</b> पेज से सीधे उस हिस्से पर जाएँ जिसकी आपको ज़रूरत है।'),
  p('<b>Turning pages:</b>', '<b>पेज कैसे पलटें:</b>'),
  li('Click the <b>Next</b> or <b>Previous</b> button below the book, or click the outer edge of a page.',
     'किताब के नीचे <b>अगला</b> या <b>पिछला</b> बटन दबाएँ, या पेज के बाहरी किनारे पर क्लिक करें।'),
  li('On a computer you can also use the ← and → arrow keys.',
     'कंप्यूटर पर आप कीबोर्ड की ← और → तीर वाली keys भी इस्तेमाल कर सकते हैं।'),
  li('Click <b>Contents</b> at any time to see the list of all topics.',
     'सभी विषयों की लिस्ट देखने के लिए कभी भी <b>विषय-सूची</b> दबाएँ।'),
  p('<b>Changing the language:</b> Use the <b>English / हिंदी</b> switch at the top of this window. The book changes language in one click and stays on the same topic.',
    '<b>भाषा बदलना:</b> इस विंडो के ऊपर दिए <b>English / हिंदी</b> बटन का इस्तेमाल करें। एक क्लिक में पूरी किताब की भाषा बदल जाती है और आप उसी विषय पर बने रहते हैं।'),
  p('<b>Words you will see often:</b>', '<b>ये शब्द बार-बार आएँगे:</b>'),
  table(
    [['Word', 'शब्द'], ['Meaning', 'मतलब']],
    [
      [['Olympiad ID', 'Olympiad ID'], ['The roll number of one student for the Olympiad. Mittsure gives your school a set of these IDs for each class.', 'Olympiad के लिए एक बच्चे का रोल नंबर। Mittsure आपके स्कूल को हर क्लास के लिए ऐसे IDs देता है।']],
      [['Allot', 'Allot'], ['To give one Olympiad ID to one student by filling in the student’s details.', 'बच्चे की जानकारी भरकर एक Olympiad ID उस बच्चे को देना।']],
      [['Mittmee App', 'Mittmee App'], ['The mobile app where students log in, upload their videos and see their results.', 'मोबाइल ऐप जिसमें बच्चे login करते हैं, अपने वीडियो डालते हैं और अपना रिज़ल्ट देखते हैं।']],
      [['Coordinator', 'Coordinator'], ['Your contact person at Mittsure.', 'Mittsure में आपका संपर्क व्यक्ति।']],
    ],
    STATUS_COLS,
  ),

  /* 2 ─ Getting started */
  ch(2, ['Getting started', 'शुरुआत कैसे करें'], ['Login, first-time agreement and the menu', 'Login, पहली बार का एग्रीमेंट और मेन्यू']),
  h('Logging in', 'Login करना'),
  box(['Steps to log in', 'Login करने के स्टेप'], [
    ['1. Open the Mittmee login page.', '1. Mittmee का login पेज खोलें।'],
    ['2. In <b>Username</b>, type the username Mittsure sent you (by email or SMS).', '2. <b>Username</b> में वह username लिखें जो Mittsure ने आपको (ईमेल या SMS से) भेजा है।'],
    ['3. Type your <b>Password</b> and click <b>Sign in to your account</b>.', '3. अपना <b>Password</b> लिखें और <b>Sign in to your account</b> दबाएँ।'],
  ]),
  p('<mark>Important:</mark> Your username is <b>not</b> the same as your School ID (for example MITT082). Typing only the School ID shows “Invalid credentials”. Use the username from your credentials message.',
    '<mark>ज़रूरी:</mark> आपका username, आपकी School ID (जैसे MITT082) जैसा <b>नहीं</b> है। सिर्फ School ID लिखने पर “Invalid credentials” आता है। अपने credentials वाले मैसेज में दिया username ही लिखें।'),
  p('Forgot your password? Contact your Mittsure coordinator. Once you are logged in, you can also raise a request from <b>Help & Support</b>.',
    'Password भूल गए? अपने Mittsure coordinator से संपर्क करें। Login होने के बाद आप <b>Help & Support</b> से भी request भेज सकते हैं।'),
  h('First login: the Onboarding Agreement', 'पहली बार login: Onboarding Agreement'),
  p('The very first time you log in, the panel shows the School Onboarding Agreement before anything else. It must be accepted once by the school’s authorised person.',
    'पहली बार login करने पर पैनल सबसे पहले School Onboarding Agreement दिखाता है। स्कूल के अधिकृत व्यक्ति को इसे एक बार स्वीकार करना होता है।'),
  box(['Steps to accept the agreement', 'एग्रीमेंट स्वीकार करने के स्टेप'], [
    ['1. Scroll and read the agreement till the end. The accept section appears only after the last part.', '1. एग्रीमेंट को आखिर तक स्क्रॉल करके पढ़ें। स्वीकार करने वाला हिस्सा आखिरी भाग के बाद ही दिखता है।'],
    ['2. Tick all the <b>Declarations</b> (all are required).', '2. सभी <b>Declarations</b> पर टिक करें (सभी ज़रूरी हैं)।'],
    ['3. Click <b>I Accept</b>. You will then go to your dashboard.', '3. <b>I Accept</b> दबाएँ। इसके बाद आप अपने dashboard पर पहुँच जाएँगे।'],
  ]),
  p('A record of the acceptance (date, time and agreement version) is kept by Mittmee. You will not be asked again unless the agreement changes.',
    'स्वीकार करने का रिकॉर्ड (तारीख, समय और एग्रीमेंट का version) Mittmee रखता है। जब तक एग्रीमेंट नहीं बदलता, आपसे दोबारा नहीं पूछा जाएगा।'),
  h('The menu on the left', 'बाईं ओर का मेन्यू'),
  p('Every screen of the panel opens from the menu on the left. On a mobile phone, tap the ☰ button at the top to open it.',
    'पैनल की हर स्क्रीन बाईं ओर के मेन्यू से खुलती है। मोबाइल फ़ोन पर इसे खोलने के लिए ऊपर दिए ☰ बटन को दबाएँ।'),
  table(
    [['Menu group', 'मेन्यू का हिस्सा'], ['What is inside', 'इसमें क्या है']],
    [
      [['Dashboard', 'Dashboard'], ['Your school’s summary at a glance.', 'एक नज़र में आपके स्कूल का सारांश।']],
      [['Students', 'Students'], ['Olympiad IDs, My Students, Student Requests, Student Report, Student Passports.', 'Olympiad IDs, My Students, Student Requests, Student Report, Student Passports।']],
      [['Videos', 'Videos'], ['Student Videos, Upload Video, Upload Status.', 'Student Videos, Upload Video, Upload Status।']],
      [['School', 'School'], ['School Profile (your details and exam date).', 'School Profile (आपकी जानकारी और परीक्षा की तारीख)।']],
      [['Help', 'Help'], ['Help & Support (ask the Mittsure team for help).', 'Help & Support (Mittsure टीम से मदद माँगें)।']],
    ],
    ['30%', '70%'],
  ),
  p('To log out, use the <b>Log out</b> option at the bottom of the menu. For safety, the panel also logs you out by itself after some time; just log in again.',
    'Logout करने के लिए मेन्यू में नीचे <b>Log out</b> का विकल्प इस्तेमाल करें। सुरक्षा के लिए पैनल कुछ समय बाद अपने-आप भी logout कर देता है; बस दोबारा login करें।'),

  /* 3 ─ Dashboard */
  ch(3, ['Dashboard', 'Dashboard'], ['Your school at a glance', 'एक नज़र में आपका स्कूल']),
  p('The Dashboard is the first screen after login. It shows how many of your students have registered and what needs your attention.',
    'Login के बाद सबसे पहली स्क्रीन Dashboard है। यह दिखाती है कि आपके कितने बच्चों ने registration कर लिया है और किस काम पर आपका ध्यान चाहिए।'),
  h('The four number boxes', 'चार नंबर वाले बॉक्स'),
  table(
    [['Box', 'बॉक्स'], ['What it shows', 'यह क्या दिखाता है']],
    [
      [['Allocated IDs', 'Allocated IDs'], ['Total Olympiad IDs (roll numbers) given to your school.', 'आपके स्कूल को मिले कुल Olympiad IDs (रोल नंबर)।']],
      [['Registered', 'Registered'], ['Students who have finished registration, and what percent that is.', 'जिन बच्चों का registration पूरा हो गया, और वह कितने प्रतिशत है।']],
      [['Pending', 'Pending'], ['IDs still waiting for a student to sign up.', 'वे IDs जिन पर अभी बच्चे का sign-up बाकी है।']],
      [['Classes', 'Classes'], ['Number of classes that have IDs.', 'कितनी क्लासों के IDs हैं।']],
    ],
    STATUS_COLS,
  ),
  p('Click any box to open the related screen.', 'संबंधित स्क्रीन खोलने के लिए किसी भी बॉक्स पर क्लिक करें।'),
  h('Other parts of the Dashboard', 'Dashboard के बाकी हिस्से'),
  li('<b>Registration rate:</b> a ring showing the percent of IDs that are registered, with done and pending counts.',
     '<b>Registration rate:</b> एक गोला जो दिखाता है कि कितने प्रतिशत IDs registered हैं, साथ में done और pending की गिनती।'),
  li('<b>Class-wise progress:</b> one bar per class, for example 12/20 registered (60%).',
     '<b>Class-wise progress:</b> हर क्लास की एक पट्टी, जैसे 12/20 registered (60%)।'),
  li('<b>Recent registrations:</b> the latest students who registered. Click <b>View all students</b> to see everyone.',
     '<b>Recent registrations:</b> हाल ही में registered हुए बच्चे। सबको देखने के लिए <b>View all students</b> दबाएँ।'),
  li('<b>Quick actions:</b> shortcuts to Olympiad IDs, My Students, Student Videos and School Profile.',
     '<b>Quick actions:</b> Olympiad IDs, My Students, Student Videos और School Profile के शॉर्टकट।'),
  li('<b>Eye icon (top right):</b> opens this guide book.', '<b>आँख वाला आइकन (ऊपर दाईं ओर):</b> यही गाइड किताब खोलता है।'),

  /* 4 ─ Olympiad IDs */
  ch(4, ['Olympiad IDs', 'Olympiad IDs'], ['Give each student a roll number', 'हर बच्चे को रोल नंबर दें']),
  p('This is the most important screen. Here you give (allot) each Olympiad ID to one student. When you allot an ID, a login account for the Mittmee App is created for that student automatically.',
    'यह सबसे ज़रूरी स्क्रीन है। यहाँ आप हर Olympiad ID एक बच्चे को देते (allot करते) हैं। ID allot करते ही उस बच्चे का Mittmee App का login account अपने-आप बन जाता है।'),
  h('What you see on the screen', 'स्क्रीन पर क्या दिखता है'),
  li('<b>Total allotted / Assigned / Pending</b> boxes at the top. Click a box to show only those IDs.',
     'ऊपर <b>Total allotted / Assigned / Pending</b> बॉक्स। सिर्फ वही IDs देखने के लिए बॉक्स पर क्लिक करें।'),
  li('<b>Search ID or name</b> box to find one ID or one student quickly.',
     'किसी एक ID या बच्चे को जल्दी ढूँढने के लिए <b>Search ID or name</b> बॉक्स।'),
  li('Class buttons (<b>All classes</b>, Nursery, LKG …) to see one class at a time.',
     'एक बार में एक क्लास देखने के लिए क्लास वाले बटन (<b>All classes</b>, Nursery, LKG …)।'),
  li('IDs are grouped class by class. Click a class heading to fold or open it.',
     'IDs क्लास के हिसाब से समूह में दिखते हैं। क्लास के नाम पर क्लिक करके उसे बंद या खोल सकते हैं।'),
  li('<b>Export</b> (top right) downloads the list you are seeing as a CSV file for Excel.',
     '<b>Export</b> (ऊपर दाईं ओर) जो लिस्ट दिख रही है उसे Excel के लिए CSV फ़ाइल में डाउनलोड करता है।'),
  h('What each status means', 'हर स्टेटस का मतलब'),
  table(
    [['Status', 'स्टेटस'], ['Meaning', 'मतलब']],
    [
      [['Pending', 'Pending'], ['The ID is free. No student has been given this ID yet.', 'ID खाली है। यह ID अभी किसी बच्चे को नहीं दी गई।']],
      [['Assigned', 'Assigned'], ['A student’s name is set on the ID.', 'ID पर बच्चे का नाम लग गया है।']],
      [['Allotted', 'Allotted'], ['The student’s app login has been created. Share the login details with the student.', 'बच्चे का ऐप login बन गया है। Login की जानकारी बच्चे को दें।']],
      [['Registered', 'Registered'], ['The student has completed registration. Nothing more to do on this ID.', 'बच्चे का registration पूरा हो गया है। इस ID पर अब कुछ करना नहीं है।']],
    ],
    STATUS_COLS,
  ),
  h('How to allot an ID to a student', 'किसी बच्चे को ID कैसे allot करें'),
  box(['Allot – step by step', 'Allot – स्टेप बाय स्टेप'], [
    ['1. Find a row with status <b>Pending</b> in the right class and click <b>Allot</b>.', '1. सही क्लास में <b>Pending</b> स्टेटस वाली लाइन ढूँढें और <b>Allot</b> दबाएँ।'],
    ['2. Check the class shown at the top of the window, so you are sure it is the right class.', '2. विंडो के ऊपर दिखाई गई क्लास देख लें, ताकि पक्का हो कि क्लास सही है।'],
    ['3. Fill in <b>Student name</b>, <b>Parent/Guardian name</b> and <b>Phone number</b> (10 digits); these are required. <b>Email address</b> is optional.', '3. <b>Student name</b>, <b>Parent/Guardian name</b> और <b>Phone number</b> (10 अंक) भरें; ये ज़रूरी हैं। <b>Email address</b> ज़रूरी नहीं है।'],
    ['4. Click <b>Allot</b>.', '4. <b>Allot</b> दबाएँ।'],
    ['5. If you gave an email, keep <b>Send by email</b> ticked to email the login details to the parent. Click <b>Send & Allot</b>.', '5. अगर ईमेल दिया है, तो login की जानकारी माता-पिता को ईमेल करने के लिए <b>Send by email</b> पर टिक रहने दें। <b>Send & Allot</b> दबाएँ।'],
    ['6. The window shows the <b>Olympiad ID</b>, <b>User ID</b> and <b>Password</b>. Note them down or share them with the student, then click <b>Done</b>.', '6. विंडो में <b>Olympiad ID</b>, <b>User ID</b> और <b>Password</b> दिखते हैं। इन्हें लिख लें या बच्चे को दे दें, फिर <b>Done</b> दबाएँ।'],
  ]),
  p('No email, or the window says the email could not be sent? The account is still created. Just share the details shown on the screen with the parent yourself.',
    'ईमेल नहीं दिया, या विंडो में लिखा आए कि ईमेल नहीं जा सका? तब भी account बन चुका है। स्क्रीन पर दिखी जानकारी आप खुद माता-पिता को दे दें।'),
  p('<b>Brothers and sisters:</b> two children can use the same parent phone number and email. Each child still gets a separate User ID and password.',
    '<b>भाई-बहन:</b> दो बच्चे माता-पिता का एक ही फ़ोन नंबर और ईमेल इस्तेमाल कर सकते हैं। फिर भी हर बच्चे को अलग User ID और password मिलता है।'),
  h('Correcting or removing an allotment', 'Allotment सुधारना या हटाना'),
  li('<b>Pencil icon (Edit):</b> change the student’s name, phone or email. Click <b>Save</b>.',
     '<b>पेंसिल आइकन (Edit):</b> बच्चे का नाम, फ़ोन या ईमेल बदलें। <b>Save</b> दबाएँ।'),
  li('<b>Bin icon (Remove):</b> takes the ID back from the student so it becomes free again. The student’s app account on this ID is also removed, so use it only for a real mistake.',
     '<b>डस्टबिन आइकन (Remove):</b> बच्चे से ID वापस ले लेता है और ID फिर से खाली हो जाती है। इस ID से जुड़ा बच्चे का ऐप account भी हट जाता है, इसलिए इसे सिर्फ असली गलती होने पर ही इस्तेमाल करें।'),
  li('Once a student is <b>Registered</b>, these buttons are no longer shown. For changes after that, raise a request in <b>Help & Support</b>.',
     'बच्चा <b>Registered</b> हो जाने के बाद ये बटन नहीं दिखते। उसके बाद बदलाव के लिए <b>Help & Support</b> में request भेजें।'),
  p('No IDs on this screen? Your coordinator has not allocated IDs to your school yet. Please contact them.',
    'इस स्क्रीन पर कोई ID नहीं है? मतलब आपके coordinator ने अभी आपके स्कूल को IDs नहीं दिए हैं। कृपया उनसे संपर्क करें।'),

  /* 5 ─ What the student does */
  ch(5, ['What the student does next', 'इसके बाद बच्चा क्या करता है'], ['In the Mittmee App', 'Mittmee App में']),
  box(['Student’s steps', 'बच्चे के स्टेप'], [
    ['1. Install the <b>Mittmee App</b> on the parent’s phone.', '1. माता-पिता के फ़ोन में <b>Mittmee App</b> इंस्टॉल करें।'],
    ['2. Log in with the <b>User ID</b> and <b>Password</b> you shared.', '2. आपके दिए <b>User ID</b> और <b>Password</b> से login करें।'],
    ['3. Set a new password of their own (the app asks for this on first login).', '3. अपना नया password बनाएँ (पहली बार login पर ऐप यह माँगता है)।'],
    ['4. Accept the Terms in the app.', '4. ऐप में Terms स्वीकार करें।'],
    ['5. Upload the two Olympiad videos (see Section 11).', '5. Olympiad के दोनों वीडियो अपलोड करें (अध्याय 11 देखें)।'],
  ]),
  p('After this, the student appears in <b>My Students</b> and the ID shows <b>Registered</b>.',
    'इसके बाद बच्चा <b>My Students</b> में दिखने लगता है और ID पर <b>Registered</b> लिखा आता है।'),
  p('If two children share one phone number or email, the app may ask which child is logging in. The password decides the account, so each child should use their own password.',
    'अगर दो बच्चे एक ही फ़ोन नंबर या ईमेल इस्तेमाल करते हैं, तो ऐप पूछ सकता है कि कौन-सा बच्चा login कर रहा है। Account password से तय होता है, इसलिए हर बच्चा अपना ही password इस्तेमाल करे।'),

  /* 6 ─ My Students */
  ch(6, ['My Students', 'My Students'], ['Registered students and exam-day attendance', 'Registered बच्चे और परीक्षा के दिन की हाज़िरी']),
  p('This screen lists every student who has registered with your school’s Olympiad IDs.',
    'इस स्क्रीन पर वे सभी बच्चे दिखते हैं जिन्होंने आपके स्कूल के Olympiad IDs से registration किया है।'),
  li('Search by name, ID or phone, or choose a class.', 'नाम, ID या फ़ोन से खोजें, या कोई क्लास चुनें।'),
  li('Click a student’s row to open their full profile (contact details).', 'पूरी प्रोफ़ाइल (संपर्क की जानकारी) देखने के लिए बच्चे की लाइन पर क्लिक करें।'),
  li('<b>Export</b> downloads the list as a CSV file.', '<b>Export</b> लिस्ट को CSV फ़ाइल में डाउनलोड करता है।'),
  h('Marking attendance on the exam day', 'परीक्षा के दिन हाज़िरी लगाना'),
  p('A coloured strip at the top tells you where attendance stands:', 'ऊपर एक रंगीन पट्टी बताती है कि हाज़िरी की स्थिति क्या है:'),
  table(
    [['Message', 'मैसेज'], ['What it means', 'मतलब']],
    [
      [['Exam date not set yet', 'Exam date not set yet'], ['Your exam date is not fixed. Request it from School Profile (Section 13).', 'आपकी परीक्षा की तारीख तय नहीं है। School Profile से इसकी request भेजें (अध्याय 13)।']],
      [['Exam scheduled for …', 'Exam scheduled for …'], ['Attendance opens automatically on that day.', 'उस दिन हाज़िरी अपने-आप खुल जाएगी।']],
      [['Attendance marking is open', 'Attendance marking is open'], ['Today is the exam day. You can mark attendance now.', 'आज परीक्षा का दिन है। अब आप हाज़िरी लगा सकते हैं।']],
      [['Attendance confirmed & sent', 'Attendance confirmed & sent'], ['Attendance has been sent to Mittsure and is locked.', 'हाज़िरी Mittsure को भेज दी गई है और लॉक हो गई है।']],
    ],
    ['38%', '62%'],
  ),
  box(['Attendance – step by step', 'हाज़िरी – स्टेप बाय स्टेप'], [
    ['1. On the exam day, open <b>My Students</b>.', '1. परीक्षा के दिन <b>My Students</b> खोलें।'],
    ['2. For every student click <b>Present</b> or <b>Absent</b>.', '2. हर बच्चे के लिए <b>Present</b> या <b>Absent</b> दबाएँ।'],
    ['3. Made a mistake? Use <b>Change attendance</b> on that row, or <b>Reset attendance</b> to clear all marks.', '3. गलती हो गई? उस लाइन पर <b>Change attendance</b> दबाएँ, या सारे निशान हटाने के लिए <b>Reset attendance</b>।'],
    ['4. When every student is marked, click <b>Confirm & Send</b> and confirm.', '4. जब हर बच्चे की हाज़िरी लग जाए, <b>Confirm & Send</b> दबाएँ और पक्का करें।'],
  ]),
  p('<mark>Careful:</mark> after <b>Confirm & Send</b> the attendance is locked and cannot be changed by you. Check it once before sending. The button stays grey until every student is marked.',
    '<mark>ध्यान दें:</mark> <b>Confirm & Send</b> के बाद हाज़िरी लॉक हो जाती है और आप उसे बदल नहीं सकते। भेजने से पहले एक बार जाँच लें। जब तक हर बच्चे की हाज़िरी नहीं लगती, बटन धूसर (grey) रहता है।'),

  /* 7 ─ Student Requests */
  ch(7, ['Student Requests', 'Student Requests'], ['App users who want to join your school', 'ऐप यूज़र जो आपके स्कूल से जुड़ना चाहते हैं']),
  p('Some children use the Mittmee App without an Olympiad ID. If such a child chooses your school in the app, their request comes here.',
    'कुछ बच्चे बिना Olympiad ID के Mittmee App इस्तेमाल करते हैं। अगर ऐसा बच्चा ऐप में आपका स्कूल चुनता है, तो उसकी request यहाँ आती है।'),
  p('<mark>Note:</mark> Approving a request only shows that child’s videos on your Student Videos screen and your school page. It does <b>not</b> give them an Olympiad ID or entry into the Olympiad.',
    '<mark>ध्यान दें:</mark> Request approve करने से सिर्फ उस बच्चे के वीडियो आपकी Student Videos स्क्रीन और स्कूल पेज पर दिखने लगते हैं। इससे बच्चे को Olympiad ID या Olympiad में entry <b>नहीं</b> मिलती।'),
  li('Tabs: <b>Pending</b> (waiting for you), <b>Linked</b> (approved), <b>Declined</b>, <b>All</b>.',
     'टैब: <b>Pending</b> (आपके फ़ैसले का इंतज़ार), <b>Linked</b> (approved), <b>Declined</b>, <b>All</b>।'),
  li('Click <b>Approve</b> if the child is from your school, or <b>Decline</b> if not.',
     'अगर बच्चा आपके स्कूल का है तो <b>Approve</b> दबाएँ, नहीं तो <b>Decline</b>।'),
  li('<b>Remove student</b> unlinks an approved child. Their videos are not deleted; they just stop showing on your pages.',
     '<b>Remove student</b> approved बच्चे को स्कूल से अलग करता है। उसके वीडियो डिलीट नहीं होते, बस आपके पेज पर दिखना बंद हो जाते हैं।'),
  li('Clearing a declined request removes it from your list; the child can ask again later.',
     'Declined request को clear करने से वह आपकी लिस्ट से हट जाती है; बच्चा बाद में फिर से request भेज सकता है।'),

  /* 8 ─ Student Report */
  ch(8, ['Student Report', 'Student Report'], ['Each student’s Olympiad progress', 'हर बच्चे की Olympiad प्रगति']),
  p('This report shows, for every allotted student, whether they registered, which videos they uploaded, and how far each video has reached.',
    'यह रिपोर्ट हर allotted बच्चे के लिए दिखाती है कि उसने registration किया या नहीं, कौन-से वीडियो डाले, और हर वीडियो कहाँ तक पहुँचा।'),
  p('Every student needs <b>two Olympiad videos</b>:', 'हर बच्चे को <b>दो Olympiad वीडियो</b> चाहिए:'),
  li('<b>Talent Performance</b> (Category A) – dance, singing, art & craft, yoga, sports and more.',
     '<b>Talent Performance</b> (Category A) – डांस, गाना, आर्ट एंड क्राफ़्ट, योग, खेल आदि।'),
  li('<b>Rhymes / Speech</b> (Category B) – a rhyme for PG/Nursery/LKG, or a short speech for UKG.',
     '<b>Rhymes / Speech</b> (Category B) – PG/Nursery/LKG के लिए कविता (rhyme), या UKG के लिए छोटा भाषण।'),
  h('Overall status of a student', 'बच्चे का कुल स्टेटस'),
  table(
    [['Status', 'स्टेटस'], ['What to do', 'क्या करें']],
    [
      [['Not registered', 'Not registered'], ['Remind the student to log in to the app.', 'बच्चे को ऐप में login करने की याद दिलाएँ।']],
      [['No uploads', 'No uploads'], ['No video yet. Remind them, or upload for them (Section 11).', 'अभी कोई वीडियो नहीं। याद दिलाएँ, या उनके लिए खुद अपलोड करें (अध्याय 11)।']],
      [['Partial upload', 'Partial upload'], ['Only one of the two videos is in.', 'दो में से सिर्फ एक वीडियो आया है।']],
      [['Awaiting review', 'Awaiting review'], ['Videos are with the Mittmee team for checking.', 'वीडियो जाँच के लिए Mittmee टीम के पास हैं।']],
      [['Rejected — reupload', 'Rejected — reupload'], ['A video was not accepted. See the reason in Upload Status and upload again.', 'एक वीडियो स्वीकार नहीं हुआ। Upload Status में कारण देखें और दोबारा अपलोड करें।']],
      [['Awaiting evaluation', 'Awaiting evaluation'], ['Both videos approved; scoring is in progress.', 'दोनों वीडियो approved; अंक देने का काम चल रहा है।']],
      [['Result published', 'Result published'], ['Scores are out. See Student Passports.', 'अंक आ गए हैं। Student Passports देखें।']],
    ],
    ['36%', '64%'],
  ),
  p('Use the boxes at the top, the search box and the class filter to find students. <b>Export CSV</b> downloads the full report.',
    'बच्चों को ढूँढने के लिए ऊपर के बॉक्स, सर्च बॉक्स और क्लास फ़िल्टर का इस्तेमाल करें। <b>Export CSV</b> पूरी रिपोर्ट डाउनलोड करता है।'),

  /* 9 ─ Student Passports */
  ch(9, ['Student Passports', 'Student Passports'], ['Holistic Progress Passport of each child', 'हर बच्चे का Holistic Progress Passport']),
  p('After results are released to your school, every completed student gets a <b>Holistic Progress Passport</b>, a report you can share with parents.',
    'जब आपके स्कूल के रिज़ल्ट जारी हो जाते हैं, तो हर पूरे हुए बच्चे को <b>Holistic Progress Passport</b> मिलता है। यह एक रिपोर्ट है जिसे आप माता-पिता के साथ शेयर कर सकते हैं।'),
  li('Before release, the screen says <i>Passports aren’t released yet</i>. Nothing needs to be done.',
     'जारी होने से पहले स्क्रीन पर <i>Passports aren’t released yet</i> लिखा आता है। कुछ करने की ज़रूरत नहीं।'),
  li('<b>Ready:</b> the passport can be opened. <b>Not ready yet / Result pending:</b> wait for the result.',
     '<b>Ready:</b> पासपोर्ट खोला जा सकता है। <b>Not ready yet / Result pending:</b> रिज़ल्ट का इंतज़ार करें।'),
  li('Click <b>Open</b> to read it, then download it as a PDF to send to parents.',
     'पढ़ने के लिए <b>Open</b> दबाएँ, फिर माता-पिता को भेजने के लिए इसे PDF में डाउनलोड करें।'),
  li('Tick <b>Ready only</b> to see only finished passports.', 'सिर्फ तैयार पासपोर्ट देखने के लिए <b>Ready only</b> पर टिक करें।'),

  /* 10 ─ Student Videos */
  ch(10, ['Student Videos', 'Student Videos'], ['Approved videos of your students', 'आपके बच्चों के approved वीडियो']),
  p('Here you can watch every approved video of your students.', 'यहाँ आप अपने बच्चों के सभी approved वीडियो देख सकते हैं।'),
  li('<b>Total in feed</b>, <b>Olympiad entries</b> and <b>General feed</b> boxes show the counts.',
     '<b>Total in feed</b>, <b>Olympiad entries</b> और <b>General feed</b> बॉक्स गिनती दिखाते हैं।'),
  li('Tabs <b>All</b>, <b>Olympiad</b> (competition videos) and <b>General</b> (other videos).',
     'टैब <b>All</b>, <b>Olympiad</b> (प्रतियोगिता वाले वीडियो) और <b>General</b> (बाकी वीडियो)।'),
  li('A <b>Linked</b> tag means the child joined through Student Requests and has no Olympiad ID.',
     '<b>Linked</b> टैग का मतलब है कि बच्चा Student Requests से जुड़ा है और उसकी कोई Olympiad ID नहीं है।'),
  li('A <i>Private</i> mark means the video is not public in the app: only the student (and the review team) can see it there.',
     '<i>Private</i> निशान का मतलब है कि वीडियो ऐप में सबके लिए नहीं है: वहाँ उसे सिर्फ बच्चा (और जाँच टीम) देख सकते हैं।'),
  li('Use the share option to copy a video link.', 'वीडियो का लिंक कॉपी करने के लिए शेयर विकल्प इस्तेमाल करें।'),
  p('Only approved videos appear here. To follow a video that is still being checked, use <b>Upload Status</b>.',
    'यहाँ सिर्फ approved वीडियो दिखते हैं। जो वीडियो अभी जाँच में है, उसे देखने के लिए <b>Upload Status</b> इस्तेमाल करें।'),

  /* 11 ─ Upload Video */
  ch(11, ['Upload Video', 'Upload Video'], ['Upload for a student or for your school', 'बच्चे के लिए या अपने स्कूल के लिए वीडियो डालें']),
  p('Students can upload from the app themselves. If a parent needs help, the school can upload the Olympiad video for the student from here.',
    'बच्चे ऐप से खुद वीडियो डाल सकते हैं। अगर माता-पिता को मदद चाहिए, तो स्कूल यहाँ से बच्चे का Olympiad वीडियो अपलोड कर सकता है।'),
  p('<mark>Age rule:</mark> Mittmee is for children aged <b>4 to 14 years</b>. The person in the video must be in this age group.',
    '<mark>उम्र का नियम:</mark> Mittmee <b>4 से 14 साल</b> के बच्चों के लिए है। वीडियो में दिखने वाला बच्चा इसी उम्र का होना चाहिए।'),
  h('Choose who the video is for', 'चुनें कि वीडियो किसके लिए है'),
  li('<b>For a student:</b> an Olympiad video for one registered student.', '<b>For a student:</b> किसी एक registered बच्चे का Olympiad वीडियो।'),
  li('<b>Our own video:</b> a video of your school (an event, an activity). After approval it shows on your school page.',
     '<b>Our own video:</b> आपके स्कूल का वीडियो (कोई कार्यक्रम, गतिविधि)। Approve होने के बाद यह आपके स्कूल पेज पर दिखता है।'),
  box(['Upload for a student – step by step', 'बच्चे के लिए अपलोड – स्टेप बाय स्टेप'], [
    ['1. Click <b>Select student</b>, search by name or ID, and choose the student.', '1. <b>Select student</b> दबाएँ, नाम या ID से खोजें और बच्चा चुनें।'],
    ['2. See which videos are still needed: <b>Submitted</b> = done, <b>Re-upload</b> = was rejected, <b>Pending</b> = not uploaded yet.', '2. देखें कौन-से वीडियो बाकी हैं: <b>Submitted</b> = हो गया, <b>Re-upload</b> = reject हुआ था, <b>Pending</b> = अभी अपलोड नहीं हुआ।'],
    ['3. Choose the <b>category</b> (Talent Performance or Rhymes / Speech) and the <b>sub category</b> (for example Dance, or a rhyme name).', '3. <b>Category</b> (Talent Performance या Rhymes / Speech) और <b>sub category</b> (जैसे Dance, या कविता का नाम) चुनें।'],
    ['4. Add the video file: click the box or drag the file into it.', '4. वीडियो फ़ाइल जोड़ें: बॉक्स पर क्लिक करें या फ़ाइल को उसमें खींचकर छोड़ें।'],
    ['5. Write a caption. Add hashtags if you like; your school tag is added automatically.', '5. Caption लिखें। चाहें तो hashtag जोड़ें; आपके स्कूल का टैग अपने-आप जुड़ जाता है।'],
    ['6. Optional: tick <b>Is this video for MittFest?</b> to also send it for MittFest.', '6. वैकल्पिक: इसे MittFest के लिए भी भेजने हेतु <b>Is this video for MittFest?</b> पर टिक करें।'],
    ['7. Choose <b>Public</b> or <b>Private</b>. This cannot be changed after upload.', '7. <b>Public</b> या <b>Private</b> चुनें। अपलोड के बाद इसे बदला नहीं जा सकता।'],
    ['8. Click <b>Upload video</b> and wait until it says <b>Video uploaded</b>.', '8. <b>Upload video</b> दबाएँ और <b>Video uploaded</b> लिखा आने तक इंतज़ार करें।'],
  ]),
  h('Video rules', 'वीडियो के नियम'),
  li('Any video format, up to <b>2 minutes</b> long.', 'कोई भी वीडियो फ़ॉर्मेट, ज़्यादा से ज़्यादा <b>2 मिनट</b> लंबा।'),
  li('Sideways (landscape) videos can be cropped to fit the phone screen with <b>Crop</b>.', 'आड़े (landscape) वीडियो को <b>Crop</b> से फ़ोन की स्क्रीन के हिसाब से काटा जा सकता है।'),
  li('Large files are made smaller automatically. Keep the page open until the upload finishes.', 'बड़ी फ़ाइलें अपने-आप छोटी हो जाती हैं। अपलोड पूरा होने तक पेज खुला रखें।'),
  li('Follow the Community Guidelines. Do not use music, clips or pictures that belong to someone else.', 'Community Guidelines का पालन करें। किसी और का संगीत, क्लिप या तस्वीर इस्तेमाल न करें।'),
  p('When both Olympiad videos of a student are submitted, no more Olympiad uploads are allowed for that student, unless one is rejected.',
    'जब किसी बच्चे के दोनों Olympiad वीडियो जमा हो जाते हैं, तो उस बच्चे के लिए और Olympiad अपलोड नहीं हो सकता, जब तक कोई वीडियो reject न हो।'),

  /* 12 ─ Upload Status */
  ch(12, ['Upload Status', 'Upload Status'], ['Track every video you uploaded', 'अपने अपलोड किए हर वीडियो की स्थिति देखें']),
  p('Every video uploaded by your school, for a student or for the school, is listed here with its review status.',
    'आपके स्कूल द्वारा अपलोड किया गया हर वीडियो, चाहे बच्चे के लिए हो या स्कूल के लिए, यहाँ उसकी जाँच की स्थिति के साथ दिखता है।'),
  table(
    [['Status', 'स्टेटस'], ['Meaning', 'मतलब']],
    [
      [['Under review', 'Under review'], ['The Mittmee team is checking the video.', 'Mittmee टीम वीडियो की जाँच कर रही है।']],
      [['Approved', 'Approved'], ['The video is accepted.', 'वीडियो स्वीकार हो गया।']],
      [['Rejected', 'Rejected'], ['Not accepted. Read the <b>Reason</b>, fix the problem and upload again from Upload Video.', 'स्वीकार नहीं हुआ। <b>Reason</b> पढ़ें, गलती सुधारें और Upload Video से दोबारा अपलोड करें।']],
    ],
    STATUS_COLS,
  ),

  /* 13 ─ School Profile */
  ch(13, ['School Profile', 'School Profile'], ['Your details and your exam date', 'आपकी जानकारी और परीक्षा की तारीख']),
  p('This screen shows your School ID, CRM / Olympiad ID, contact person, phone, email and address. These details can only be changed by Mittsure. To correct any of them, raise a request in <b>Help & Support</b> (category: Detail Updation).',
    'इस स्क्रीन पर आपकी School ID, CRM / Olympiad ID, संपर्क व्यक्ति, फ़ोन, ईमेल और पता दिखता है। इन्हें सिर्फ Mittsure बदल सकता है। किसी भी जानकारी को सुधारने के लिए <b>Help & Support</b> में request भेजें (category: Detail Updation)।'),
  h('Changing your exam date', 'परीक्षा की तारीख बदलना'),
  p('You cannot change the exam date directly. You send a request, and Mittsure approves or declines it.',
    'आप परीक्षा की तारीख सीधे नहीं बदल सकते। आप request भेजते हैं, और Mittsure उसे approve या decline करता है।'),
  box(['Exam date request – step by step', 'परीक्षा तारीख की request – स्टेप बाय स्टेप'], [
    ['1. In the <b>Exam date</b> card, click <b>Request change</b> (or <b>Request date</b> if no date is set).', '1. <b>Exam date</b> कार्ड में <b>Request change</b> दबाएँ (अगर तारीख तय नहीं है तो <b>Request date</b>)।'],
    ['2. Pick the new date. Write the reason (optional, but it helps).', '2. नई तारीख चुनें। कारण लिखें (ज़रूरी नहीं, पर इससे मदद मिलती है)।'],
    ['3. Click <b>Send request</b>.', '3. <b>Send request</b> दबाएँ।'],
    ['4. A yellow note shows <b>Change requested … Waiting for approval</b>.', '4. पीले रंग में <b>Change requested … Waiting for approval</b> लिखा आता है।'],
  ]),
  table(
    [['Result', 'नतीजा'], ['What you see', 'आपको क्या दिखेगा']],
    [
      [['Approved', 'Approved'], ['Green note. Your exam date is changed to the new date.', 'हरा नोट। आपकी परीक्षा की तारीख नई तारीख में बदल गई।']],
      [['Declined', 'Declined'], ['Red note with Mittsure’s <b>Remark</b>. Your date stays the same. You can send a new request.', 'लाल नोट, साथ में Mittsure का <b>Remark</b>। आपकी तारीख वही रहती है। आप नई request भेज सकते हैं।']],
    ],
    STATUS_COLS,
  ),
  li('Only one request can wait at a time.', 'एक समय में सिर्फ एक request इंतज़ार में रह सकती है।'),
  li('After attendance is confirmed and sent, the date is locked and no request can be sent.',
     'हाज़िरी confirm करके भेजने के बाद तारीख लॉक हो जाती है और कोई request नहीं भेजी जा सकती।'),

  /* 14 ─ Help & Support */
  ch(14, ['Help & Support', 'Help & Support'], ['Ask the Mittsure team for help', 'Mittsure टीम से मदद माँगें']),
  p('Facing a problem? Raise a request here and the Mittsure team replies on the same screen.',
    'कोई परेशानी है? यहाँ request भेजें, Mittsure टीम इसी स्क्रीन पर जवाब देती है।'),
  box(['Raise a request – step by step', 'Request भेजना – स्टेप बाय स्टेप'], [
    ['1. Click <b>New request</b>.', '1. <b>New request</b> दबाएँ।'],
    ['2. In <b>What is this about?</b> choose a category (for example Olympiad IDs & Credentials, Video Upload, Exam & Attendance).', '2. <b>What is this about?</b> में category चुनें (जैसे Olympiad IDs & Credentials, Video Upload, Exam & Attendance)।'],
    ['3. Write a short <b>Subject</b> and <b>Describe the problem</b>: what you tried, what happened, and the Olympiad IDs or student names involved.', '3. छोटा सा <b>Subject</b> लिखें और <b>Describe the problem</b> में बताएँ: आपने क्या किया, क्या हुआ, और किन Olympiad IDs या बच्चों के नाम से जुड़ा है।'],
    ['4. Add a contact person and phone if someone else should be called.', '4. अगर किसी और को कॉल करना हो तो contact person और फ़ोन लिखें।'],
    ['5. Tick <b>Urgent</b> only if the problem is blocking an exam, paper dispatch or result today.', '5. <b>Urgent</b> पर टिक तभी करें जब परेशानी आज की परीक्षा, पेपर भेजने या रिज़ल्ट को रोक रही हो।'],
    ['6. Submit. Your request gets a reference number.', '6. Submit करें। आपकी request को एक reference number मिलता है।'],
  ]),
  table(
    [['Tab', 'टैब'], ['Meaning', 'मतलब']],
    [
      [['With support team', 'With support team'], ['The team is working on it.', 'टीम इस पर काम कर रही है।']],
      [['Awaiting your reply', 'Awaiting your reply'], ['The team asked you something. Open it and reply.', 'टीम ने आपसे कुछ पूछा है। खोलें और जवाब दें।']],
      [['Resolved', 'Resolved'], ['The problem is solved.', 'परेशानी हल हो गई।']],
    ],
    STATUS_COLS,
  ),
  p('A number next to <b>Help & Support</b> in the menu means you have new replies.',
    'मेन्यू में <b>Help & Support</b> के पास दिखने वाला नंबर बताता है कि आपके लिए नए जवाब आए हैं।'),

  /* 15 ─ The whole process */
  ch(15, ['The complete Olympiad process', 'Olympiad की पूरी प्रक्रिया'], ['From login to result', 'Login से रिज़ल्ट तक']),
  p('Follow these steps in order. Each step names the screen where it is done.',
    'इन स्टेप को इसी क्रम में करें। हर स्टेप में उस स्क्रीन का नाम है जहाँ यह काम होता है।'),
  table(
    [['Step', 'स्टेप'], ['What to do', 'क्या करना है']],
    [
      [['1. Log in', '1. Login'], ['Log in with your username and accept the Onboarding Agreement.', 'अपने username से login करें और Onboarding Agreement स्वीकार करें।']],
      [['2. Check IDs', '2. IDs देखें'], ['Open <b>Olympiad IDs</b> and check you have IDs for every class.', '<b>Olympiad IDs</b> खोलें और देखें कि हर क्लास के IDs मिले हैं।']],
      [['3. Allot', '3. Allot करें'], ['Allot one ID to each student and share the User ID and Password.', 'हर बच्चे को एक ID allot करें और User ID व Password दें।']],
      [['4. Student signs in', '4. बच्चे का login'], ['The student logs in to the Mittmee App, sets a new password and accepts the Terms.', 'बच्चा Mittmee App में login करता है, नया password बनाता है और Terms स्वीकार करता है।']],
      [['5. Videos', '5. वीडियो'], ['Two videos per student: Talent Performance and Rhymes / Speech. From the app, or via <b>Upload Video</b>.', 'हर बच्चे के दो वीडियो: Talent Performance और Rhymes / Speech। ऐप से, या <b>Upload Video</b> से।']],
      [['6. Follow up', '6. जाँच करते रहें'], ['Check <b>Student Report</b> and <b>Upload Status</b>. Re-upload rejected videos.', '<b>Student Report</b> और <b>Upload Status</b> देखें। Reject हुए वीडियो दोबारा डालें।']],
      [['7. Exam date', '7. परीक्षा की तारीख'], ['Make sure the date in <b>School Profile</b> is right; request a change if needed.', '<b>School Profile</b> में तारीख सही है, यह पक्का करें; ज़रूरत हो तो बदलाव की request भेजें।']],
      [['8. Exam day', '8. परीक्षा का दिन'], ['Mark every student Present or Absent in <b>My Students</b>, then <b>Confirm & Send</b>.', '<b>My Students</b> में हर बच्चे को Present या Absent करें, फिर <b>Confirm & Send</b>।']],
      [['9. Results', '9. रिज़ल्ट'], ['When results are released, open <b>Student Passports</b> and share the PDFs with parents.', 'रिज़ल्ट जारी होने पर <b>Student Passports</b> खोलें और PDF माता-पिता को भेजें।']],
    ],
    ['26%', '74%'],
  ),

  /* 16 ─ Common problems */
  ch(16, ['Common problems and answers', 'आम परेशानियाँ और उनके हल']),
  h('“Invalid credentials” at login', 'Login पर “Invalid credentials”'),
  p('Use the <b>username</b> from your credentials message, not the School ID alone. Check that Caps Lock is off.',
    'अपने credentials वाले मैसेज का <b>username</b> लिखें, सिर्फ School ID नहीं। देख लें कि Caps Lock बंद है।'),
  h('The student did not get the email', 'बच्चे को ईमेल नहीं मिला'),
  p('Ask them to check the Spam folder. Check the email address with the pencil icon on Olympiad IDs. You can also share the details shown at the time of allotment yourself.',
    'उनसे Spam फ़ोल्डर देखने को कहें। Olympiad IDs पर पेंसिल आइकन से ईमेल पता जाँचें। Allot करते समय दिखी जानकारी आप खुद भी दे सकते हैं।'),
  h('Wrong student allotted to an ID', 'ID गलत बच्चे को allot हो गई'),
  p('If the student is not yet Registered: use the pencil icon to fix the details, or the bin icon to free the ID. If already Registered: raise a request in Help & Support.',
    'अगर बच्चा अभी Registered नहीं है: पेंसिल आइकन से जानकारी सुधारें, या डस्टबिन आइकन से ID खाली करें। अगर Registered हो चुका है: Help & Support में request भेजें।'),
  h('A video was rejected', 'वीडियो reject हो गया'),
  p('Open <b>Upload Status</b> and read the reason. Fix it (length, sound, someone else’s music, etc.) and upload again; the <b>Re-upload</b> option opens for that video.',
    '<b>Upload Status</b> खोलें और कारण पढ़ें। उसे ठीक करें (लंबाई, आवाज़, किसी और का संगीत आदि) और दोबारा अपलोड करें; उस वीडियो के लिए <b>Re-upload</b> का विकल्प खुल जाता है।'),
  h('Attendance button is grey', 'हाज़िरी वाला बटन धूसर (grey) है'),
  p('Either it is not the exam day yet, or some students are not marked. Mark every student Present or Absent first.',
    'या तो अभी परीक्षा का दिन नहीं है, या कुछ बच्चों की हाज़िरी नहीं लगी है। पहले हर बच्चे को Present या Absent करें।'),
  h('Still stuck?', 'फिर भी परेशानी है?'),
  p('Raise a request in <b>Help & Support</b> or call your Mittsure coordinator. We are happy to help.',
    '<b>Help & Support</b> में request भेजें या अपने Mittsure coordinator को कॉल करें। हमें आपकी मदद करके खुशी होगी।'),
];

const pick = (b: Bi, lang: GuideLang) => (lang === 'en' ? b[0] : b[1]);

function toBlock(b: GuideBlock, lang: GuideLang): HandbookBlock {
  switch (b.k) {
    case 'chapter': return { k: 'chapter', n: b.n, title: pick(b.title, lang), subtitle: b.subtitle && pick(b.subtitle, lang), newPage: b.newPage };
    case 'heading': return { k: 'heading', text: pick(b.text, lang) };
    case 'p': return { k: 'p', text: pick(b.text, lang), indent: b.indent };
    case 'table': return { k: 'table', head: b.head.map(c => pick(c, lang)), rows: b.rows.map(r => r.map(c => pick(c, lang))), cols: b.cols };
    case 'template': return { k: 'template', title: pick(b.title, lang), lines: b.lines.map(l => pick(l, lang)) };
  }
}

const EDITIONS: Record<GuideLang, Handbook> = {
  en: { title: 'School Panel Guide – MITTMEE', version: '1.0', effectiveDate: 'November 2026', blocks: BLOCKS.map(b => toBlock(b, 'en')) },
  hi: { title: 'स्कूल पैनल गाइड – MITTMEE', version: '1.0', effectiveDate: 'नवंबर 2026', blocks: BLOCKS.map(b => toBlock(b, 'hi')) },
};

export function schoolGuide(lang: GuideLang): Handbook {
  return EDITIONS[lang];
}
