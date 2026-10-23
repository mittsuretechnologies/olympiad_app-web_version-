// Evaluator Terms & Conditions (Part A) and Privacy Policy (Part B), shown in
// the first-login gate (TermsAcceptanceModal). Client-safe: plain data only.
// Wording follows what the Portal actually does — if evaluator behaviour
// changes (assignment, locking, logging, retention), update the matching clause.
// `**x**` renders bold.

export type TermsBlock =
  | { kind: 'p'; text: string }
  | { kind: 'ul'; items: string[] }
  | { kind: 'ol'; items: string[] }
  | { kind: 'table'; head: string[]; rows: string[][] };

export interface TermsSection {
  title: string; // "1. Definitions"
  blocks: TermsBlock[];
}

export interface TermsPart {
  heading: string;
  intro: string;
  sections: TermsSection[];
}

export const EVALUATOR_TERMS_INTRO =
  'By accessing this portal as an Evaluator, you confirm that you have read, understood and agree to the Evaluator Terms & Conditions (Part A) and the Evaluator Privacy Policy (Part B).';

export const EVALUATOR_TERMS_CONSENT =
  'I have read and agree to the Evaluator Terms & Conditions and the Evaluator Privacy Policy. I consent to the Company processing my personal data as described in them.';

// Bump the version whenever the wording changes: every evaluator is then asked
// to accept again, and each acceptance row pins the version + a hash of the text.
export const EVALUATOR_TERMS_KEY = 'EVALUATOR_TERMS';
export const EVALUATOR_TERMS_VERSION = '1.0';

export const EVALUATOR_TERMS_DECLARATIONS = [
  EVALUATOR_TERMS_CONSENT,
  'I understand that Submissions show children, and that I must not download, record, copy or share them.',
];

export const EVALUATOR_TERMS_PARTS: TermsPart[] = [
  {
    heading: 'Part A: Evaluator Terms & Conditions',
    intro:
      'These Terms govern your access to the Mittmee portal as an Evaluator. By ticking "I agree" on first login, you agree to them. If you do not agree, do not use the portal.',
    sections: [
      {
        title: '1. Definitions',
        blocks: [
          {
            kind: 'ul',
            items: [
              '**Company**, **we**, **us**: Mittsure Technologies, Bapu Nagar, Jaipur, Rajasthan.',
              '**Portal**: the Mittmee evaluator dashboard and the related systems.',
              '**Evaluator**, **you**: the person given an Evaluator ID by the Company.',
              '**Participant**: a student whose video has been submitted for the Olympiad. Most Participants are minors.',
              "**Submission**: a Participant's video, thumbnail and the details shown with it.",
              '**Evaluation**: the scores (5 criteria, 0 to 4 marks each, 20 in total) and remarks you give a Submission.',
              '**Confidential Information**: Submissions, Participant details, Evaluations, results before they are announced, scoring rubrics, and anything else you see on the Portal that is not public.',
            ],
          },
        ],
      },
      {
        title: '2. Eligibility and appointment',
        blocks: [
          {
            kind: 'ol',
            items: [
              'You are at least 18 years old and qualified to evaluate the Olympiad.',
              "Your appointment is at the Company's discretion. The Company assigns you specific schools, and you may evaluate only the Submissions from those schools that the Portal shows you.",
              "You are an employee of the Company. These Terms apply in addition to your employment terms and the Company's code of conduct and policies. If they conflict, the stricter rule on confidentiality and on the protection of children applies.",
            ],
          },
        ],
      },
      {
        title: '3. Your account',
        blocks: [
          {
            kind: 'ol',
            items: [
              'Your Evaluator ID and password are for your use only. Do not share them or let anyone else evaluate under your account.',
              'Keep the password you receive secret. If you need it reset, ask your administrator.',
              'Tell us at once at support@mittsure.com if you think someone else has used your account.',
              'You are responsible for all activity under your account.',
            ],
          },
        ],
      },
      {
        title: '4. What you will do',
        blocks: [
          {
            kind: 'ol',
            items: [
              'Watch each assigned Submission in full and score it on the 5 prescribed criteria, using the rubric shown on the Portal.',
              'Add remarks only when they are relevant to the Submission. Keep them respectful and suitable to be read by a child and their parents.',
              'Each Submission is evaluated by one Evaluator. Once you submit scores, the Submission is locked for other Evaluators.',
              'You may edit your scores until they are published. After publishing, they are locked unless you unpublish them, and every change is logged.',
              'Complete your Evaluations by the deadlines the Company gives you for each round.',
            ],
          },
        ],
      },
      {
        title: '5. Fair and impartial evaluation',
        blocks: [
          {
            kind: 'ol',
            items: [
              'Score each Submission only on its merit and the prescribed criteria.',
              "Do not let a Participant's name, school, region, gender, religion, caste, disability or any personal link affect your score.",
              'Do not accept money, gifts, favours or any other benefit to influence a score, and report any such offer to us.',
              'Do not contact a Participant, their family or school about a Submission.',
            ],
          },
        ],
      },
      {
        title: '6. Conflict of interest',
        blocks: [
          {
            kind: 'ol',
            items: [
              'If a Participant or school is related to you in any way (family, student, employer, client, or similar), tell us before evaluating and do not score that Submission.',
              'If you notice a conflict after scoring, tell us at once so it can be reassigned.',
            ],
          },
        ],
      },
      {
        title: '7. Confidentiality',
        blocks: [
          {
            kind: 'ol',
            items: [
              'Keep all Confidential Information secret, during and after your appointment.',
              'Use it only to carry out Evaluations on the Portal.',
              'Do not discuss scores or results with anyone outside the authorised evaluation process, including on social media, before or after results are announced.',
            ],
          },
        ],
      },
      {
        title: '8. Protection of children and their content',
        blocks: [
          { kind: 'p', text: 'Submissions show children. You must **not**:' },
          {
            kind: 'ul',
            items: [
              'download, screenshot, screen-record, photograph or copy any Submission or Participant detail;',
              'store it on any personal device, cloud drive or messaging app;',
              'share, post, forward or show it to anyone;',
              'use it for any purpose other than the Evaluation.',
            ],
          },
          {
            kind: 'p',
            text: 'If you see content that suggests a child is at risk of harm, or content that is inappropriate, report it to us at once at support@mittsure.com. Do not act on it yourself.',
          },
        ],
      },
      {
        title: '9. Personal data',
        blocks: [
          {
            kind: 'ol',
            items: [
              "You will see Participants' personal data: name, Olympiad ID, class, school, state and video. You must handle it only as allowed in these Terms and in line with the Digital Personal Data Protection Act, 2023 and other applicable law.",
              'Do not try to see data outside your assigned schools or role, or to get around any limit on the Portal.',
              'Report any suspected data leak to us at support@mittsure.com at once, and in any case within 24 hours.',
            ],
          },
        ],
      },
      {
        title: '10. Integrity of the Portal and results',
        blocks: [
          { kind: 'p', text: 'You must not:' },
          {
            kind: 'ul',
            items: [
              "alter, delete or manipulate scores or records outside the Portal's normal process;",
              'use bots, scripts, or automated or AI tools to watch or score Submissions, or enter any Submission or Participant data into any AI tool;',
              "try to access, test, break or bypass the Portal's security;",
              'upload any harmful code.',
            ],
          },
        ],
      },
      {
        title: '11. Monitoring and audit',
        blocks: [
          {
            kind: 'p',
            text: 'We log every Evaluation action: submit, edit, publish and unpublish, with the earlier and new values. We may review these logs, and moderate, revise or set aside any Evaluation, to keep results fair.',
          },
        ],
      },
      {
        title: '12. Intellectual property',
        blocks: [
          {
            kind: 'ol',
            items: [
              'Submissions belong to the Participants or their guardians, as set out in the Participant terms.',
              'The Portal, scoring rubrics and Olympiad materials belong to the Company.',
              'You assign to the Company all rights in the scores and remarks you create on the Portal, so that they can be used in results, reports and certificates.',
            ],
          },
        ],
      },
      {
        title: '13. Remuneration',
        blocks: [
          {
            kind: 'p',
            text: 'No separate fee is payable for evaluation work. It is part of your regular duties and is covered by your salary under your employment terms.',
          },
        ],
      },
      {
        title: '14. Suspension and termination',
        blocks: [
          {
            kind: 'ol',
            items: [
              'We may suspend or end your access at any time, with or without notice, including for any breach of these Terms.',
              'We may then reassign or cancel your Evaluations.',
              'Clauses 7, 8, 9, 12 and 15 to 17 continue after your access ends.',
              'When your access ends, delete any notes you hold that relate to the Olympiad.',
            ],
          },
        ],
      },
      {
        title: '15. Liability and indemnity',
        blocks: [
          {
            kind: 'ol',
            items: [
              'You are responsible for your own acts and omissions on the Portal.',
              'You will indemnify the Company against losses, claims and penalties caused by your breach of these Terms or of applicable law, including data protection and child protection laws.',
              'The Portal is provided "as is". The Company is not liable for interruptions or data loss that are not caused by its negligence.',
            ],
          },
        ],
      },
      {
        title: '16. Changes to these Terms',
        blocks: [
          {
            kind: 'p',
            text: 'We may update these Terms. We will show the new version on the Portal, and you may need to accept it again before you continue.',
          },
        ],
      },
      {
        title: '17. Governing law and disputes',
        blocks: [
          {
            kind: 'p',
            text: "These Terms are governed by the laws of India. The courts at Jaipur, Rajasthan have exclusive jurisdiction.",
          },
        ],
      },
    ],
  },
  {
    heading: 'Part B: Evaluator Privacy Policy',
    intro:
      'This Policy explains what personal data the Company collects about you as an Evaluator, why, and your rights. It follows the Digital Personal Data Protection Act, 2023 (DPDP Act). The Company is the Data Fiduciary.',
    sections: [
      {
        title: '1. Data we collect about you',
        blocks: [
          {
            kind: 'table',
            head: ['Data', 'Where it comes from', 'Why we use it'],
            rows: [
              ['Name, email address', 'You or the admin who creates your account', 'To create your account, send your login details, and contact you'],
              ['Evaluator ID, password', 'Created by the Portal', 'To log you in. Passwords are stored encrypted.'],
              ['Schools assigned to you', 'The Company', 'To show you only the Submissions from your assigned schools'],
              ['Date and time you accepted these Terms', 'The Portal', 'To prove you accepted them'],
              ['Evaluations: scores, remarks, and when they were submitted, edited, published or unpublished', 'Your use of the Portal', 'To produce results, and to audit and resolve disputes'],
              ['Permissions given to your account', 'The Company', 'To control which sections of the Portal you can open'],
            ],
          },
          { kind: 'p', text: 'We do not collect your location or contacts, and we do not track you outside the Portal.' },
        ],
      },
      {
        title: '2. Lawful basis',
        blocks: [
          {
            kind: 'p',
            text: 'We process your data for purposes related to your employment, as a legitimate use under section 7 of the DPDP Act, and with the consent you give when you accept these Terms.',
          },
        ],
      },
      {
        title: '3. Who can see your data',
        blocks: [
          {
            kind: 'ul',
            items: [
              'Authorised Company staff: administrators and reviewers who manage evaluators and check results.',
              'Service providers who host the Portal, store files and send emails for us, under contracts that bind them to protect your data. These are cloud hosting, file storage and email providers.',
              'Authorities, when the law requires it.',
            ],
          },
          { kind: 'p', text: 'Participants and schools do not see your name next to scores. We do not sell your data.' },
        ],
      },
      {
        title: '4. How long we keep it',
        blocks: [
          {
            kind: 'ul',
            items: [
              "Account details: for as long as you work for the Company, and afterwards as part of the Company's employment records.",
              "Evaluations and the audit log: permanently, as part of the Olympiad's result records, so that results and certificates can be checked at any time.",
            ],
          },
        ],
      },
      {
        title: '5. Security',
        blocks: [
          {
            kind: 'p',
            text: 'The Portal uses encrypted passwords, role-based access, school-wise assignment and an audit log of evaluation actions. Videos play in the browser with downloading turned off. No system is fully secure, so please also protect your password and your device.',
          },
        ],
      },
      {
        title: '6. Your rights',
        blocks: [
          { kind: 'p', text: 'Under the DPDP Act you can:' },
          {
            kind: 'ul',
            items: [
              'ask what data we hold about you;',
              'ask us to correct or update it;',
              'ask us to erase it, unless we need to keep it by law or to protect the integrity of results;',
              'withdraw your consent. You will then no longer be able to act as an Evaluator;',
              'nominate a person to exercise these rights if you die or become incapacitated;',
              'raise a grievance with us, and then with the Data Protection Board of India.',
            ],
          },
        ],
      },
      {
        title: '7. Contact and grievances',
        blocks: [
          {
            kind: 'p',
            text: 'To ask about your data, use any of your rights, or raise a grievance, write to the Company at support@mittsure.com. We will respond as soon as reasonably possible.',
          },
        ],
      },
      {
        title: '8. Changes',
        blocks: [
          {
            kind: 'p',
            text: 'We will post any change to this Policy on the Portal. Where the law needs it, we will ask for your consent again.',
          },
        ],
      },
    ],
  },
];
