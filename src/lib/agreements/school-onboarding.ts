/**
 * School Onboarding Agreement — the text a school's Authorised Representative
 * must read and accept on first login to the School Panel.
 *
 * Source: "10 School Onboarding V2.docx" (legal). The structure here is
 * rendered by AgreementDocument on screen, flattened by agreementPlainText()
 * for the email copy / PDF certificate, and hashed server-side so every
 * acceptance record pins the exact wording that was shown.
 *
 * ANY change to the wording must bump VERSION. Acceptance is tracked per
 * version, so a bump re-shows the agreement to every school (Section 17.2).
 *
 * Isomorphic on purpose (no Node imports): the school gate and the superadmin
 * viewer render it in the browser.
 */

export const SCHOOL_AGREEMENT_KEY = 'SCHOOL_ONBOARDING';
export const SCHOOL_AGREEMENT_VERSION = '1.0';
export const SCHOOL_AGREEMENT_LAST_UPDATED = '7 October 2026';
export const SCHOOL_AGREEMENT_TITLE = 'School Onboarding Agreement';

export const COMPANY_NAME = 'Mittsure Technologies LLP';
const COMPANY_ADDRESS = 'S-14, 3rd floor, Mangal Marg, Bapu Nagar, Jaipur, Rajasthan - 302015';

/* ── Shape ───────────────────────────────────────────────────────────────── */

export interface AgreementItem {
  /** Marker shown before the item: "(a)", "(i)" … */
  n: string;
  /** Bold lead-in, e.g. a defined term or a clause heading. */
  lead?: string;
  text: string;
  items?: AgreementItem[];
}

export interface AgreementClause {
  /** Clause number, e.g. "5.2". Omitted for un-numbered paragraphs. */
  n?: string;
  lead?: string;
  text: string;
  items?: AgreementItem[];
}

export interface AgreementTable {
  columns: [string, string, string];
  rows: [string, string, string][];
}

export interface AgreementSection {
  /** Anchor id for the table of contents. */
  id: string;
  /** "1", "2" … or "" for un-numbered sections (Background). */
  n: string;
  title: string;
  clauses: AgreementClause[];
  table?: AgreementTable;
}

export interface AgreementDoc {
  title: string;
  version: string;
  lastUpdated: string;
  notice: string;
  preamble: string[];
  sections: AgreementSection[];
}

/* ── Text ────────────────────────────────────────────────────────────────── */

export const SCHOOL_AGREEMENT: AgreementDoc = {
  title: SCHOOL_AGREEMENT_TITLE,
  version: SCHOOL_AGREEMENT_VERSION,
  lastUpdated: SCHOOL_AGREEMENT_LAST_UPDATED,
  notice:
    `The MITTMEE mobile application, the website at https://mittmee.com/ and the Admin Portal are owned and operated by ${COMPANY_NAME}, a company incorporated under the Companies Act, 2013, having its registered office at ${COMPANY_ADDRESS}. ` +
    `By clicking "I Accept" and verifying at the end of this Agreement, you confirm that you are authorised to accept this Agreement on behalf of the School, and the School enters into a binding agreement with ${COMPANY_NAME} on the terms below, including the School's responsibilities as a joint Data Fiduciary.`,
  preamble: [
    'This School Onboarding Agreement (the "Agreement") is between:',
    `${COMPANY_NAME}, a company incorporated under the Companies Act, 2013, having its registered office at ${COMPANY_ADDRESS} (the "Company", which expression includes its successors and permitted assigns); and`,
    'the school whose details are submitted on the Admin Portal at the time of acceptance (the "School Details"), acting through the trust, society or company that runs and manages it (the "School", which expression includes its successors and permitted assigns).',
    'The Company and the School are each a "Party" and together the “Parties".',
  ],
  sections: [
    {
      id: 'background',
      n: '',
      title: 'Background',
      clauses: [
        { n: 'A.', text: 'The Company owns and operates the MITTMEE mobile application (the "App") and the website at https://mittmee.com/ (the "Website"), on which users can upload and share videos showing their creativity, and conducts the Olympiad (the “Olympiad").' },
        { n: 'B.', text: 'The School wishes to enable its students to participate in the Olympiad through the App.' },
        { n: 'C.', text: 'Under the Digital Personal Data Protection Act, 2023 (the "DPDP Act") and the Digital Personal Data Protection Rules, 2025 (the "DPDP Rules"), a child\'s personal data may not be processed without the verifiable consent of the child\'s parent or lawful guardian.' },
        { n: 'D.', text: 'The School will decide which of its students take part in the Olympiad, register them on the Admin Portal, collect verifiable parental consent and, where the parent consents, upload videos on behalf of its students. The Parties have therefore agreed to act as joint Data Fiduciaries for that processing, and to allocate their responsibilities between them, on the terms of this Agreement.' },
      ],
    },
    {
      id: 's1',
      n: '1',
      title: 'Definitions',
      clauses: [
        {
          n: '1.1',
          text: 'In this Agreement:',
          items: [
            { n: '(a)', lead: '"Admin Portal"', text: 'means the school administrator section of the Website, through which the School creates and manages Student accounts and uploads videos on behalf of Students.' },
            { n: '(b)', lead: '"Admin User"', text: 'means an employee of the School to whom the School gives access to the Admin Portal, and who has accepted the School Admin Portal Terms of Use.' },
            { n: '(c)', lead: '"App Processing"', text: 'means all processing of personal data through the App other than Joint Processing, including hosting, reviewing, displaying and storing videos, operating Student accounts, and all processing after the Olympiad.' },
            { n: '(d)', lead: '"Applicable Law"', text: 'means all laws in force in India, including the DPDP Act, the DPDP Rules, the Information Technology Act, 2000 and the rules made under it, the Copyright Act, 1957, and the Protection of Children from Sexual Offences Act, 2012 (“POCSO”).' },
            { n: '(e)', lead: '"Authorised Representative"', text: 'means the person who accepts this Agreement on the Admin Portal on behalf of the School under Section 18.' },
            { n: '(f)', lead: '"Consent Form"', text: 'means the parental consent form provided by the Company to the School, as updated by the Company from time to time.' },
            {
              n: '(g)', lead: '"Joint Processing"', text: 'means the processing of Student Data for the following purposes:',
              items: [
                { n: '(i)', text: 'obtaining, verifying and recording parental consent;' },
                { n: '(ii)', text: '. registering Students and creating Student accounts on the Admin Portal;' },
                { n: '(iii)', text: 'distributing login credentials to Students;' },
                { n: '(iv)', text: 'recording, collecting and uploading School Uploads; and' },
                { n: '(v)', text: "administering the Olympiad, including sharing Students' participation status, entries and results with the School." },
              ],
            },
            { n: '(h)', lead: '"Parent"', text: 'means the parent or lawful guardian of a Student.' },
            { n: '(i)', lead: '"Personal Data Breach"', text: 'has the meaning given in the DPDP Act.' },
            { n: '(j)', lead: '"School Upload"', text: "means a video uploaded by the School to a Student's account through the Admin Portal under Section 7." },
            { n: '(k)', lead: '"Student"', text: 'means a student of the School registered by the School for the Olympiad.' },
            { n: '(l)', lead: '"Student Data"', text: 'means the personal data of Students and Parents that is processed under this Agreement, including completed Consent Forms, Student details, login credentials and videos of Students.' },
          ],
        },
      ],
    },
    {
      id: 's2',
      n: '2',
      title: 'Scope of the partnership',
      clauses: [
        {
          n: '2.1',
          text: 'The Company will:',
          items: [
            { n: '(a)', text: 'activate an administrator account on the Admin Portal for the School once this Agreement is accepted;' },
            { n: '(b)', text: 'allow the School to create Student accounts, each with a unique Olympiad ID;' },
            { n: '(c)', text: 'allow the School to upload videos on behalf of Students, in accordance with Section 7;' },
            { n: '(d)', text: "conduct the Olympiad in accordance with the Olympiad Rules, and share the participation status, entries and results of the School's Students with the School; and" },
            { n: '(e)', text: 'provide reasonable support and training to Admin Users on the use of the Admin Portal, the consent process and School Uploads.' },
          ],
        },
        { n: '2.2', text: "Student accounts, once created and activated, are governed by the Company's Terms of Use for Children and Parent/Guardian Agreement, Privacy Policy, Children's Privacy Policy and Community Guidelines. After the Olympiad, Student accounts continue as normal App accounts under those terms." },
      ],
    },
    {
      id: 's3',
      n: '3',
      title: 'Roles under the DPDP Act',
      clauses: [
        { n: '3.1', lead: 'Joint Data Fiduciaries:', text: 'The Company and the School together determine the purposes and means of the Joint Processing, and are therefore joint Data Fiduciaries for the Joint Processing within the meaning of Section 2(i) of the DPDP Act.' },
        { n: '3.2', lead: 'Company as sole Data Fiduciary for the App:', text: 'The Company alone determines the purposes and means of App Processing and is the sole Data Fiduciary for it. The School has no role in, and no responsibility for, App Processing.' },
        { n: '3.3', lead: "School's own records:", text: 'The School remains an independent Data Fiduciary for the personal data it holds for its own purposes as a school, such as admission and academic records. This Agreement does not affect that processing.' },
        { n: '3.4', lead: 'Responsibility:', text: 'The Company is not responsible for the acts or omissions of the School, its Admin Users or its staff, including any failure to obtain or verify parental consent, enter accurate Student details, hand over credentials securely, handle Consent Forms or videos securely, or comply with Sections 5 to 8. The School is solely responsible for those acts and omissions to Students, Parents, the Data Protection Board of India and any other authority.' },
        { n: '3.5', lead: 'No agency:', text: 'Nothing in this Agreement makes either Party the agent or Data Processor of the other.' },
      ],
    },
    {
      id: 's4',
      n: '4',
      title: 'Allocation of responsibilities for Joint Processing',
      clauses: [
        { n: '4.1', text: 'The Parties allocate their responsibilities for the Joint Processing as follows:' },
      ],
      table: {
        columns: ['Responsibility', 'Company', 'School'],
        rows: [
          ['Notice to Parents and Consent Form', 'Prepares the notice and Consent Form in compliance with the DPDP Act and DPDP Rules, and keeps them up to date', 'Gives the current Consent Form to Parents, and answers basic questions about it'],
          ['Obtaining and verifying consent', 'Provides the method and training', 'Collects signed Consent Forms, verifies Parents and records consent on the Admin Portal (Section 5)'],
          ['Accuracy of Student details', 'Provides the means to correct details', 'Enters accurate details and corrects errors (Section 6)'],
          ['Login credentials', 'Generates initial credentials and requires a password change on first login', 'Hands credentials over securely (Section 6)'],
          ['School Uploads', 'Reviews every upload before it goes live', 'Ensures consent and content requirements are met (Section 7)'],
          ['Security safeguards', "For the App, the Admin Portal and data on the Company's systems", 'For Consent Forms, School devices, credentials before handover and videos before upload'],
          ['Rights requests and grievances', 'Acts as the single point of contact for Parents through its Grievance Officer, and responds within the prescribed timelines', 'Forwards any request or grievance it receives to the Company within 2  working days, and cooperates'],
          ['Withdrawal of consent', 'Deactivates the account or stops School Uploads, and erases data in accordance with its Privacy Policy', 'Records withdrawals it receives on the Admin Portal, or informs the Company within 2 working days'],
          ['Personal Data Breach', 'Notifies the Data Protection Board of India and affected Parents of breaches on its systems, and coordinates joint notifications', 'Notifies the Company within 24 hours of any breach involving Student Data in its possession, and cooperates in notifying the Board and Parents (Section 8.2)'],
          ['Retention and erasure', 'Retains and erases data on its systems in accordance with its Privacy Policy', 'Keeps Consent Forms for the period in Section 5.4, and deletes videos and other Student Data as required by Sections 7.5 and 8.5'],
        ],
      },
    },
    {
      id: 's5',
      n: '5',
      title: 'Parental consent',
      clauses: [
        { n: '5.1', lead: 'No account without consent:', text: "The School must not create a Student account on the Admin Portal unless it has first obtained a Consent Form, completed and signed by the Student's Parent, in the form provided to it by the Company." },
        { n: '5.2', lead: 'Verification:', text: "Before accepting a Consent Form, the School must take reasonable steps to verify that the person signing it is the Student's Parent and is an adult, using identity and contact details of the Parent already held in the School's admission records, or by checking a valid identity document in person. The School must record the method of verification. The School must not keep a copy of any identity document shown to it for this purpose." },
        { n: '5.3', lead: 'Recording consent on the Admin Portal:', text: "When creating each Student account, the School must confirm on the Admin Portal that a signed Consent Form has been received and verified, and record the Parent's choice on each optional consent, including consent to School Uploads." },
        { n: '5.4', lead: 'Original forms:', text: 'The School must keep the original signed Consent Forms securely for the duration of this Agreement and for three years after it ends, and produce them to the Company within 3 working days of a request, including where required by the Data Protection Board of India or any other authority.' },
        { n: '5.5', lead: 'Optional consents:', text: "The School must record each Parent's choice on every optional consent accurately, and must not pressure any Parent to give an optional consent." },
        { n: '5.6', lead: 'Withdrawal:', text: "If a Parent tells the School that they wish to withdraw consent (whether all consent, or only the consent to School Uploads), the School must record this on the Admin Portal or inform the Company at support@mittsure.com within 2 working days. Where all consent is withdrawn, the Company will deactivate the Student account and erase the Student's personal data in accordance with its Privacy Policy." },
      ],
    },
    {
      id: 's6',
      n: '6',
      title: 'Student details and credentials',
      clauses: [
        { n: '6.1', lead: 'Accuracy:', text: 'The School must enter only accurate and complete Student details, and only for students who are enrolled in the School and registered for the Olympiad. The School must promptly correct any errors that it discovers or that a Parent reports' },
        { n: '6.2', lead: 'Minimum data:', text: 'The School must enter only the fields requested on the Admin Portal and must not upload any other information about Students or Parents.' },
        { n: '6.3', lead: 'Credentials:', text: "The School must hand over each Student's login ID and initial password only to the Student or the Student's Parent, in a sealed slip or other secure manner, and must not display credentials publicly, share them by group messages, or keep copies after handover." },
        { n: '6.4', lead: 'First login:', text: 'The School must inform Students and Parents that the password must be changed on first login, and that the School will not have access to the new password.' },
        { n: '6.5', lead: 'No use of Student accounts by staff.', text: 'No Admin User or other School staff may log in to a Student account. School Uploads must be made only through the Admin Portal.' },
      ],
    },
    {
      id: 's7',
      n: '7',
      title: 'Uploading videos on behalf of Students',
      clauses: [
        { n: '7.1', lead: 'Consent required:', text: "The School may upload a video to a Student's account only if the Student's Parent has consented to School Uploads on the Consent Form, and that consent has not been withdrawn." },
        {
          n: '7.2', lead: 'Content:', text: 'The School must ensure that each School Upload:',
          items: [
            { n: '(a)', text: "is the Student's own work;" },
            { n: '(b)', text: "complies with the Community Guidelines and does not reveal personal information such as the Student's full name, the School's name, logo, uniform badge or ID card, or any contact details;" },
            { n: '(c)', text: "does not show any other student or person unless that person has agreed to appear in it and, for a child, that child's Parent has also agreed; and" },
            { n: '(d)', text: 'does not include music, video or other material that the School knows or has reason to believe is used without the right to use it.' },
          ],
        },
        { n: '7.3', lead: 'Review:', text: 'Every School Upload is reviewed by the Company before it goes live, in the same way as any other video. Where a School Upload is not approved or is removed, the Company will inform the School and the Parent of the reason, with the relevant violation code from the Community Guidelines.' },
        { n: '7.4', lead: 'Ownership:', text: "A School Upload is the Student's User Content. It belongs to the Student and is governed by the Company's user terms. The School has no ownership of, or right to use, a School Upload other than to make the upload. Once a School Upload is on the App, it is subject to App Processing, for which the Company is the sole Data Fiduciary." },
        {
          n: '7.5', lead: 'Handling of videos by the School.', text: 'The School must:',
          items: [
            { n: '(a)', text: 'record and handle videos of Students only for the purpose of uploading them under this Section;' },
            { n: '(b)', text: "not publish, share or use the videos for any other purpose, including on the School's own website or social media, unless the School has separately obtained the Parent's consent for that use; and" },
            { n: '(c)', text: "delete all copies of a video from School devices and storage within 7 days after it is uploaded, except where the School needs to keep a copy for its own lawful purposes as a school and has the Parent's consent to do so." },
          ],
        },
        { n: '7.6', lead: "Parent's control.", text: "The Parent may delete any School Upload, or ask the Company to do so, and may withdraw consent to School Uploads at any time without affecting the Student's account." },
        { n: '7.7', lead: 'Responsibility.', text: 'The School is responsible for School Uploads made by its Admin Users, including any breach of Section 7.2.' },
      ],
    },
    {
      id: 's8',
      n: '8',
      title: 'Data protection obligations of the School',
      clauses: [
        {
          n: '8.1', text: 'In relation to the Joint Processing, the School must:',
          items: [
            { n: '(a)', text: 'process Student Data only for the purposes of the Joint Processing set out in this Agreement;' },
            { n: '(b)', text: 'ensure that only Admin Users and staff who need access for this Agreement have access, and that each is bound by confidentiality;' },
            { n: '(c)', text: 'ensure that each Admin User accepts the School Admin Portal Terms of Use before using the Admin Portal, and keeps their own login credentials confidential;' },
            { n: '(d)', text: 'keep completed Consent Forms and any printed Student Data in a locked place, and any electronic copies, including videos, on secure, access-controlled systems;' },
            { n: '(e)', text: 'not download, export, copy, sell, share or use Student Data from the Admin Portal for any other purpose, except results that the Company makes available to the School for its own records;' },
            { n: '(f)', text: "the school must make sure its staff never screen-record, screenshot, photograph, download or copy any child's video, image or profile from the app or the portal. That includes using another phone or a third-party tool, and sharing anything outside the app is also banned." },
            { n: '(g)', text: 'not transfer Student Data outside India;' },
            { n: '(h)', text: "not engage any Data Processor or other third party for the Joint Processing without the Company's prior written consent;" },
            { n: '(i)', text: 'comply with the obligations of a Data Fiduciary under the DPDP Act and the DPDP Rules for the part of the Joint Processing allocated to it under Section 4, including implementing reasonable security safeguards; and' },
            { n: '(j)', text: 'comply with Applicable Law.' },
          ],
        },
        { n: '8.2', lead: 'Personal Data Breach.', text: 'The School must inform the Company at support@mittsure.com within 24 hours of becoming aware of any actual or suspected Personal Data Breach involving Student Data (for example, lost Consent Forms, disclosed passwords, a lost device containing Student videos, or unauthorised access to the Admin Portal), with all known details. The Parties will cooperate to contain the breach and to notify the Data Protection Board of India and affected Parents within the time required under the DPDP Rules. Unless the Parties agree otherwise in writing, the Company will coordinate those notifications on behalf of both Parties.' },
        { n: '8.3', lead: 'Requests from Parents:', text: "If the School receives a request from a Parent to access, correct or erase a Student's data, or a grievance about the Joint Processing or the App, the School must forward it to the Company within 2 working days and cooperate in responding to it." },
        { n: '8.4', lead: 'Audit:', text: 'On reasonable notice, the School will allow the Company to verify its compliance with Sections 5 to 8, including by inspecting a sample of Consent Forms.' },
        { n: '8.5', lead: 'Return and deletion:', text: "On termination of this Agreement, or on the Company's request, the School must return or securely destroy all Student Data in its possession collected under this Agreement, including videos, other than the original Consent Forms, which it must keep for the period in Section 5.4 or hand over to the Company." },
        { n: '8.6', lead: "Recording of children's content:", text: "Section 8.1(f) applies to all content on the App, and not only to the School's own Students. It does not prevent the School from recording original videos of its own Students for School Uploads under Section 7, subject to Section 7.5. Any breach of Section 8.1(f) is a material breach of this Agreement. The Company may immediately suspend the School's access to the Admin Portal and terminate this Agreement. Where the conduct may amount to an offence, including under POCSO or the Information Technology Act, 2000, the Company will report it to the appropriate authorities." },
      ],
    },
    {
      id: 's9',
      n: '9',
      title: 'Obligations of the Company',
      clauses: [
        {
          n: '9.1', text: 'The Company will:',
          items: [
            { n: '(a)', text: 'comply with the DPDP Act and the DPDP Rules as the sole Data Fiduciary for App Processing, and as a joint Data Fiduciary for its part of the Joint Processing;' },
            { n: '(b)', text: "process Student Data in accordance with Applicable Law, its Privacy Policy and Children's Privacy Policy;" },
            { n: '(c)', text: 'store Student Data on servers located in India and protect it with reasonable security safeguards;' },
            { n: '(d)', text: 'not undertake tracking or behavioural monitoring of Students, and not direct targeted advertising at them;' },
            { n: '(e)', text: 'review every video, including every School Upload, before it goes live on the App, and act on reports in accordance with its Community Guidelines;' },
            { n: '(f)', text: 'ensure that the Admin Portal allows School Uploads only for Students whose Parents have consented to them;' },
            { n: '(g)', text: "act as the single point of contact for Parents' rights requests and grievances, as set out in Section 4;" },
            { n: '(h)', text: 'make the current Consent Form and training material available to the School; and' },
            { n: '(i)', text: 'inform the School without delay of any Personal Data Breach affecting its Students that requires action by the School.' },
          ],
        },
      ],
    },
    {
      id: 's10',
      n: '10',
      title: 'Child safeguarding',
      clauses: [
        { n: '10.1', text: 'Each Party will inform the other promptly if it becomes aware of any concern about the safety or wellbeing of a Student in connection with the App or the Olympiad.' },
        { n: '10.2', text: "Nothing in this Agreement affects either Party's own obligations to report offences under POCSO or other Applicable Law." },
      ],
    },
    {
      id: 's11',
      n: '11',
      title: 'Intellectual property and publicity',
      clauses: [
        { n: '11.1', text: "Each Party keeps ownership of its own names, logos and trademarks. The Company may display the School's name and logo on the Website and in Olympiad materials as a participating school with the School's prior written approval." },
        { n: '11.2', text: "The School may use the Olympiad name and logo only to inform its students and Parents about the Olympiad, in accordance with the Company's guidelines." },
        { n: '11.3', text: "Videos uploaded by or on behalf of Students belong to the Students and are governed by the Company's user terms. The Company will not use them outside the App except as permitted under its user terms and the optional consents in the Consent Form." },
      ],
    },
    {
      id: 's12',
      n: '12',
      title: 'Confidentiality',
      clauses: [
        { n: '12.1', text: 'Each Party will keep confidential all non-public information received from the other Party under this Agreement and use it only for the purposes of this Agreement. This obligation survives termination for three years, and indefinitely for Student Data.' },
      ],
    },
    {
      id: 's13',
      n: '13',
      title: 'Representations and warranties',
      clauses: [
        { n: '13.1', text: 'Each Party represents that it has full power and authority to enter into this Agreement.' },
        {
          n: '13.2', text: 'The School represents that:',
          items: [
            { n: '(a)', text: 'the Authorised Representative is authorised to accept this Agreement on behalf of the School and the trust, society or company that runs and manages it, and the School is bound by that acceptance;' },
            { n: '(b)', text: 'the School Details provided before creation of the present School admin account were true and complete; and' },
            { n: '(c)', text: 'it will perform its obligations using appropriately trained staff.' },
          ],
        },
      ],
    },
    {
      id: 's14',
      n: '14',
      title: 'Indemnity and liability',
      clauses: [
        { n: '14.1', text: 'Each Party bears its own responsibility. Each Party is responsible for any penalty imposed on it by the Data Protection Board of India or any other authority for its own breach of the DPDP Act, the DPDP Rules or other Applicable Law.' },
        { n: '14.2', text: 'The School will indemnify and keep the Company indemnified against any claim, penalty, compensation, cost (including reasonable legal costs) or loss arising from any act or omission of the School, its Admin Users or its staff in breach of this Agreement or Applicable Law. This includes creating a Student account without valid parental consent, making a School Upload in breach of Section 7, any Personal Data Breach of Student Data in the School\'s possession, and any breach of Section 8.1(f). It also includes any penalty imposed on the Company by the Data Protection Board of India or any other authority as a result of such act or omission.' },
        { n: '14.3', text: 'Neither Party is liable to the other for indirect or consequential loss. Except for liability under Sections 8, 12, 14.2 and 14.3.' },
      ],
    },
    {
      id: 's15',
      n: '15',
      title: 'Term and termination',
      clauses: [
        { n: '15.1', text: 'This Agreement starts on the date it is accepted under Section 18 (the "Effective Date") and continues unless either Party gives 30 days\' written notice of non-renewal.' },
        { n: '15.2', text: "Either Party may terminate this Agreement by giving 30 days' written notice." },
        { n: '15.3', text: "The Company may suspend the School's access to the Admin Portal immediately, or terminate this Agreement by written notice, if the School breaches Sections 5 to 8 and, where the breach can be remedied, fails to remedy it within 7 days of notice." },
        {
          n: '15.4', lead: 'Effect of termination.', text: 'On termination:',
          items: [
            { n: '(a)', text: "the School's access to the Admin Portal ends, and the School may no longer make School Uploads;" },
            { n: '(b)', text: 'the School ceases to be a joint Data Fiduciary for any further processing, and the Company continues as the sole Data Fiduciary for Student Data on the App;' },
            { n: '(c)', text: "Student accounts already activated, and videos already uploaded, continue under the Company's user terms, unless a Parent withdraws consent or deletes them;" },
            { n: '(d)', text: 'the School must comply with Section 8.5; and' },
            { n: '(e)', text: 'Sections 4, 5.4, 7.4, 7.5, 8, 11.3, 12, 14, 16 and 17 survive in respect of Joint Processing carried out before termination.' },
          ],
        },
      ],
    },
    {
      id: 's16',
      n: '16',
      title: 'Dispute resolution and governing law',
      clauses: [
        { n: '16.1', text: 'This Agreement is governed by the laws of India.' },
        { n: '16.2', text: 'The Parties will first try to resolve any dispute through discussions between senior representatives for 30 days.' },
        { n: '16.3', text: 'If not resolved, the dispute will be referred to arbitration by a sole arbitrator appointed by mutual agreement, under the Arbitration and Conciliation Act, 1996. The seat of arbitration will be Jaipur, and the language English.' },
        { n: '16.4', text: 'Subject to Section 16.3, the courts at Jaipur have exclusive jurisdiction.' },
      ],
    },
    {
      id: 's17',
      n: '17',
      title: 'General',
      clauses: [
        { n: '17.1', text: 'Notices must be in writing and sent by email: to the Company at support@mittsure.com, and to the School at the official email address registered on the Admin Portal. Notices may also be shown to the School on the Admin Portal.' },
        { n: '17.2', lead: 'Updates to this Agreement and the Consent Form.', text: 'The Company may update this Agreement or the Consent Form, including to comply with Applicable Law, by giving the School at least 15 days\' notice by email or on the Admin Portal. The School will be asked to accept the updated Agreement on the Admin Portal. If the School does not accept it, either Party may terminate this Agreement under Section 15.2, and the current version will continue to apply until termination. An updated Consent Form must be used for all new Students from the date stated in the notice.' },
        { n: '17.3', lead: 'Assignment:', text: "The School may not assign this Agreement without the Company's prior written consent." },
        { n: '17.4', lead: 'Entire agreement:', text: 'This Agreement is the entire agreement between the Parties on its subject matter.' },
        { n: '17.5', lead: 'Severability:', text: 'If any provision is held invalid, the rest of the Agreement continues in force.' },
        { n: '17.6', lead: 'Force majeure:', text: 'Neither Party is liable for delay or failure caused by events beyond its reasonable control.' },
      ],
    },
    {
      id: 's18',
      n: '18',
      title: 'Electronic acceptance',
      clauses: [
        { n: '18.1', text: 'This Agreement is an electronic record under the Information Technology Act, 2000 and is formed electronically under Section 10A of that Act. It does not require any physical signature.' },
        { n: '18.2', text: 'This Agreement is accepted on behalf of the School when the Authorized Representative: (a) ticks the acceptance boxes and clicks "I Accept"; and (b) verifies the acceptance' },
        { n: '18.3', lead: 'Deemed authority:', text: 'Any person who accepts this Agreement on the Admin Portal on behalf of the School is deemed to have been authorized by the School, and by the trust, society or company that runs and manages it, to do so. The School is bound by that acceptance and may not later deny it on the ground that the person was not authorized.' },
        { n: '18.4', text: "The School's administrator account will be activated on acceptance. The Company will email a copy of the accepted Agreement to the School's registered official email address." },
      ],
    },
  ],
};

/* ── Acceptance declarations ─────────────────────────────────────────────── */

/**
 * The four checkboxes from the "Acceptance screen" note at the end of the
 * agreement. All are required before "I Accept" is enabled. The rendered text
 * (with the school's name filled in) is stored on the acceptance record.
 */
export function schoolAgreementDeclarations(): string[] {
  return [
    'I confirm that I am authorized to accept this Agreement on behalf of the School and the trust, society or company that runs it.',
    'I confirm that the School details I have entered are true and complete.',
    'I have read and understood this Agreement, including that the School acts as a joint Data Fiduciary with Mittsure Technologies for parental consent, student registration, credentials and School Uploads, and I accept it on behalf of the School.',
    'I understand that this Agreement is accepted electronically and is legally binding on the School without a physical signature.',
  ];
}

/* ── Plain text ──────────────────────────────────────────────────────────── */

function itemLines(items: AgreementItem[] | undefined, depth: number): string[] {
  if (!items) return [];
  const pad = '    '.repeat(depth);
  return items.flatMap(it => [
    `${pad}${it.n} ${it.lead ? `${it.lead} ` : ''}${it.text}`,
    ...itemLines(it.items, depth + 1),
  ]);
}

/**
 * Canonical plain-text rendering. This exact string is what gets hashed
 * (SHA-256) onto each acceptance record, so keep it deterministic.
 */
export function agreementPlainText(doc: AgreementDoc = SCHOOL_AGREEMENT): string {
  const lines: string[] = [
    doc.title,
    `Version: ${doc.version}`,
    `Last updated: ${doc.lastUpdated}`,
    '',
    `IMPORTANT – PLEASE READ: ${doc.notice}`,
    '',
    ...doc.preamble,
  ];
  for (const s of doc.sections) {
    lines.push('', s.n ? `${s.n}. ${s.title}` : s.title);
    for (const c of s.clauses) {
      lines.push(`${c.n ? `${c.n} ` : ''}${c.lead ? `${c.lead} ` : ''}${c.text}`);
      lines.push(...itemLines(c.items, 1));
    }
    if (s.table) {
      lines.push(s.table.columns.join(' | '));
      for (const r of s.table.rows) lines.push(r.join(' | '));
    }
  }
  return lines.join('\n');
}
