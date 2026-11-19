/**
 * MITTMEE Evaluator's Handbook (confidential).
 *
 * Source: "Mittmee Evaluator's Handbook.pdf" (Mittsure Technologies LLP,
 * 15 November 2026). Wording is verbatim. Numbered and bulleted items keep
 * their "1." / "•" markers in the text, since several sections say the steps
 * must be followed in order.
 *
 * Two departures from the PDF, both because the portal replaces paper:
 *  - Section 8's table sits right after its opening paragraph, where the PDF
 *    page layout pushed it below the following paragraph.
 *  - Section 11's signature box (Name / Olympiad / session / Signature / Date)
 *    is replaced by a note: the undertaking is given electronically at first
 *    login, and the acceptance record holds the evaluator's name, Evaluator ID,
 *    date and time. Its seven points are EVALUATOR_HANDBOOK_UNDERTAKING
 *    (lib/evaluatorTerms.ts), shared with the acceptance gate.
 *
 * Confidential: import this only from server code. It reaches the browser
 * through GET /api/staff/handbook, which admits the EVALUATOR role, so the text
 * never ships in a public JS bundle. It is also part of the Evaluator Terms
 * acceptance (Part C): its text is in the SHA-256 pinned on every acceptance
 * record (lib/evaluatorTermsServer.ts), so ANY wording change here must bump
 * EVALUATOR_TERMS_VERSION, and every evaluator is asked to accept again.
 */

import type { Handbook } from '@/lib/handbook/moderator-handbook';
import { EVALUATOR_HANDBOOK_UNDERTAKING } from '@/lib/evaluatorTerms';

export const EVALUATOR_HANDBOOK: Handbook = {
  title: 'MITTMEE Evaluator’s Handbook',
  version: '1.0',
  // No effective date is shown on this handbook (the PDF's date line is left
  // out on purpose); an empty value hides the line in the book.
  effectiveDate: '',
  blocks: [
    /* 1 */
    { k: 'chapter', n: 1, title: 'About this handbook' },
    { k: 'p', text: 'This handbook sets the rules every Evaluator must follow when marking Olympiad videos on the MITTMEE App. Read it fully, and sign the undertaking in Section 11 before you receive access.' },
    { k: 'p', indent: 1, text: '1. <b>Who it applies to.</b> Every person, whether an employee, consultant, contractor or volunteer, whom Mittsure Technologies LLP (“Mittmee”, “we”) appoints to evaluate Olympiad videos (“Evaluator”, “you”).' },
    { k: 'p', indent: 1, text: '2. <b>What it covers.</b> The video round of the Olympiad only. The written booklet round is covered by the separate Uploader and Reviewer Handbook.' },
    { k: 'p', indent: 1, text: '3. <b>Other documents you must follow.</b> This handbook works alongside the Terms of Use, the Terms of Use for Children and Parent, the Privacy Policy, the Children’s Privacy Policy, the Community Guidelines, the Olympiad Rules and the Moderators’ Handbook. If anything here conflicts with law or with the Children’s Privacy Policy, the law and that policy prevail.' },
    { k: 'p', indent: 1, text: '4. <b>Why it matters.</b> Almost every person whose video you watch is a child. Their videos, names and Olympiad IDs are personal data of children under the Digital Personal Data Protection Act, 2023. Mishandling them can harm a child, and can expose you and Mittmee to legal action.' },

    /* 2 */
    { k: 'chapter', n: 2, title: 'Your role' },
    { k: 'p', text: 'You mark Olympiad videos that the Moderators have already approved, and you record each mark against the participant’s Olympiad ID. Your marks form the video component of the Olympiad result.' },
    { k: 'p', text: '<b>You will:</b>' },
    { k: 'p', indent: 1, text: '• evaluate only the Olympiad videos assigned to you, after the submission window closes;' },
    { k: 'p', indent: 1, text: '• mark each video fairly and in line with the marking procedure decided by Mittmee for that Olympiad;' },
    { k: 'p', indent: 1, text: '• record the mark against the correct Olympiad ID in the evaluation panel;' },
    { k: 'p', indent: 1, text: '• report any concern about a video as set out in Section 8.' },
    { k: 'p', text: '<b>You will not:</b>' },
    { k: 'p', indent: 1, text: '• approve, reject or edit videos: that is the Moderators’ role;' },
    { k: 'p', indent: 1, text: '• contact any child, parent, guardian, teacher or Partner School about a video or a mark;' },
    { k: 'p', indent: 1, text: '• disclose any mark or result before Mittmee officially announces it;' },
    { k: 'p', indent: 1, text: '• evaluate a video outside the evaluation panel, or keep any record of it outside that panel.' },

    /* 3 */
    { k: 'chapter', n: 3, title: 'Before you start' },
    { k: 'p', text: 'You receive evaluation access only after completing all four steps below.' },
    { k: 'p', indent: 1, text: '1. <b>Sign the undertaking.</b> Sign the confidentiality and data protection undertaking in Section 11, and any separate confidentiality agreement Mittmee asks for.' },
    { k: 'p', indent: 1, text: '2. <b>Complete training.</b> Attend Mittmee’s evaluator briefing on the marking procedure, this handbook and the Community Guidelines.' },
    { k: 'p', indent: 1, text: '3. <b>Declare conflicts of interest.</b> Tell Mittmee in writing if you are related to, teach, coach or otherwise know any participant, or are connected with any Partner School taking part. Mittmee will not assign you those videos. If you recognise a child or school during evaluation, stop and follow Section 8.' },
    { k: 'p', indent: 1, text: '4. <b>Receive your own login.</b> Mittmee issues a personal login to the evaluation panel. It is for you alone and must never be shared.' },

    /* 4 */
    { k: 'chapter', n: 4, title: 'Evaluation procedure' },
    { k: 'p', text: 'Follow these steps for every video, in this order.' },
    { k: 'p', indent: 1, text: '1. <b>Log in</b> to the evaluation panel from an approved device (Section 7). Never evaluate from a shared or public device.' },
    { k: 'p', indent: 1, text: '2. <b>Open your assigned queue.</b> Evaluate only videos assigned to you. Do not search for or open other videos.' },
    { k: 'p', indent: 1, text: '3. <b>Check the Olympiad ID</b> shown with the video against the entry in your queue before you watch it.' },
    { k: 'p', indent: 1, text: '4. <b>Watch the whole video</b> at normal speed, with sound, before marking. Re-watch if needed.' },
    { k: 'p', indent: 1, text: '5. <b>Mark the video</b> fairly and in line with the marking procedure decided by Mittmee for that Olympiad (Section 5).' },
    { k: 'p', indent: 1, text: '6. <b>Record the mark</b> against the same Olympiad ID in the evaluation panel. Add a short remark only where the procedure asks for one, and keep it about the performance, never about the child personally.' },
    { k: 'p', indent: 1, text: '7. <b>Check before you submit</b> that the mark and the Olympiad ID match. Once submitted, a mark can be changed only under Section 9.' },
    { k: 'p', indent: 1, text: '8. <b>Log out</b> when you finish or step away, even briefly.' },
    { k: 'p', text: 'Marks are always recorded against the Olympiad ID only. Do not write a child’s name, school, photograph or any other identifying detail in remarks, notes or messages.' },

    /* 5 */
    { k: 'chapter', n: 5, title: 'Fair marking' },
    { k: 'p', text: 'Every child must be marked by the same standard, on the performance alone.' },
    { k: 'p', indent: 1, text: '• <b>Follow the decided procedure.</b> Apply only the marking procedure Mittmee has decided for that Olympiad. Do not add, drop or reweigh anything on your own.' },
    { k: 'p', indent: 1, text: '• <b>Mark the performance, not the child.</b> A child’s name, school, appearance, accent, language, home, clothing, gender, religion, caste or background must play no part.' },
    { k: 'p', indent: 1, text: '• <b>Ignore video quality beyond the procedure.</b> Do not reward or penalise an expensive phone, a better room or editing, unless the procedure expressly says so.' },
    { k: 'p', indent: 1, text: '• <b>Stay consistent.</b> Apply the same standard to the first video of the day and the last. Take breaks to avoid fatigue.' },
    { k: 'p', indent: 1, text: '• <b>Mark independently.</b> Do not discuss a video or a mark with other Evaluators, unless Mittmee runs a moderation or calibration exercise.' },
    { k: 'p', indent: 1, text: '• <b>No outside influence.</b> Refuse any request, gift, payment or pressure from a parent, school or anyone else about a mark, and report it to Mittmee at once.' },
    { k: 'p', indent: 1, text: '• <b>When unsure, ask.</b> Raise doubts about the procedure with the Olympiad coordinator before marking, not after.' },

    /* 6 */
    { k: 'chapter', n: 6, title: 'Children’s data is sensitive and must never leak' },
    { k: 'p', text: 'Everything you see as an Evaluator is confidential personal data of children. You may use it only to mark the video, and for no other purpose, during or after your engagement.' },
    { k: 'p', text: '<b>What counts as children’s data.</b> The video itself, the child’s face, voice and surroundings, the display name, Olympiad ID, school, class, marks, remarks and any other detail visible in the panel.' },
    { k: 'p', text: '<b>You must never:</b>' },
    { k: 'p', indent: 1, text: '• download, screenshot, screen-record or photograph any video or screen, including with a second phone or camera;' },
    { k: 'p', indent: 1, text: '• copy, forward or share any video, name, Olympiad ID, mark or screenshot by WhatsApp, email, social media, cloud drive or any other means;' },
    { k: 'p', indent: 1, text: '• show the panel or a video to anyone, including family members, friends or colleagues not working on the evaluation;' },
    { k: 'p', indent: 1, text: '• discuss any child, video or mark outside Mittmee’s official channels, including after the Olympiad ends;' },
    { k: 'p', indent: 1, text: '• try to find out who a child is, or look them up on social media or elsewhere;' },
    { k: 'p', indent: 1, text: '• use any video or data for training, portfolios, personal use or any AI tool.' },
    { k: 'p', text: '<b>Why this is serious.</b> Leaked videos of children can be misused by strangers and cannot be recalled once shared. Under the Digital Personal Data Protection Act, 2023, Mittmee must protect this data, and penalties for a breach can be very high. Disclosing personal information obtained under a contract without consent is also an offence under Section 72A of the Information Technology Act, 2000, punishable with imprisonment up to three years, a fine up to ₹5 lakh, or both. Any person who stores or shares sexual material involving a child commits an offence under the POCSO Act, 2012.' },
    { k: 'p', text: 'Your duty of confidentiality continues after your engagement with Mittmee ends.' },

    /* 7 */
    { k: 'chapter', n: 7, title: 'Device, access and security rules' },
    { k: 'p', text: 'Access the evaluation panel only in the way Mittmee permits.' },
    { k: 'p', indent: 1, text: '• <b>Approved devices only.</b> Use a Mittmee-issued device, or a personal device Mittmee has approved, with a screen lock, current software and antivirus.' },
    { k: 'p', indent: 1, text: '• <b>Private place.</b> Evaluate where no one else can see or hear the screen. Use headphones. Never evaluate in public places or on public Wi-Fi.' },
    { k: 'p', indent: 1, text: '• <b>Your login is personal.</b> Never share your password or one-time password (OTP), and never let anyone else use your login. Mittmee records every login and every action in the panel.' },
    { k: 'p', indent: 1, text: '• <b>Nothing leaves the panel.</b> Do not install screen-capture or recording software, browser extensions that save pages, or remote-access tools while evaluating.' },
    { k: 'p', indent: 1, text: '• <b>Lock or log out</b> whenever you leave the device.' },
    { k: 'p', indent: 1, text: '• <b>Lost device or suspected misuse.</b> Report it to Mittmee immediately (Section 10) so access can be blocked.' },
    { k: 'p', indent: 1, text: '• <b>End of engagement.</b> Return any Mittmee device, and delete any personal notes on evaluation, when your work ends or when Mittmee asks. Your access will be closed.' },

    /* 8 */
    { k: 'chapter', n: 8, title: 'Issues found during evaluation' },
    { k: 'p', text: 'If something in a video worries you, do not mark it. Flag it in the panel and report it to the Olympiad coordinator the same day.' },
    {
      k: 'table', head: ['What you notice', 'What to do'], cols: ['34%', '66%'],
      rows: [
        ['Any sign of abuse, sexual content, nudity or danger to a child', 'Stop watching. Do not download or share it. Flag it and report it to Mittmee <b>immediately</b>, so the matter can be handled and reported under the POCSO Act, 2012 and the Community Guidelines.'],
        ['The video breaks the Community Guidelines but was approved', 'Flag it for the Moderators and do not mark it until they decide.'],
        ['The Olympiad ID does not match, or the video seems to belong to another participant', 'Do not mark it. Flag the mismatch.'],
        ['The video seems not to be the child’s own work, or copied from another source', 'Flag it with a short factual remark. Mittmee will decide under the Olympiad Rules.'],
        ['Video is blank, corrupt or will not play', 'Flag it as a technical issue. Do not mark it as zero.'],
        ['You know or recognise the child, family or school', 'Stop. Tell the coordinator so the video can be reassigned.'],
      ],
    },
    { k: 'p', text: 'Never contact the child, parent or school yourself, and never share the video while reporting. Use only the panel’s flag option or Mittmee’s official reporting channel.' },

    /* 9 */
    { k: 'chapter', n: 9, title: 'Corrections and re-evaluation' },
    { k: 'p', text: 'A submitted mark can be changed only through Mittmee, never directly by you.' },
    { k: 'p', indent: 1, text: '1. <b>Your own error.</b> If you realise you entered a wrong mark or Olympiad ID, tell the coordinator in writing at once, giving the Olympiad ID and the correct mark. Mittmee will make and log the correction.' },
    { k: 'p', indent: 1, text: '2. <b>Re-evaluation.</b> Where Mittmee orders re-evaluation, for example after a grievance or a mismatch, the video may be given to a different Evaluator. Mark it afresh under Section 5, without looking at the earlier mark.' },
    { k: 'p', indent: 1, text: '3. <b>Audit.</b> Mittmee may sample and check marks for consistency. Cooperate with any review and explain your marking if asked.' },
    { k: 'p', indent: 1, text: '4. <b>Final results.</b> Results are declared only by Mittmee, as provided in the Olympiad Rules. Never share or confirm a mark to anyone.' },

    /* 10 */
    { k: 'chapter', n: 10, title: 'Breach and consequences' },
    { k: 'p', text: 'Report any actual or suspected leak, loss or misuse of children’s data to Mittmee immediately, and in any case within 2 hours of noticing it, at <a href="mailto:grievance@mittsure.com">grievance@mittsure.com</a> and to the Olympiad coordinator. Report it even if you caused it: early reporting lets Mittmee contain the harm and meet its own duty to inform parents and the Data Protection Board of India.' },
    { k: 'p', text: 'When reporting, say what happened, when, which Olympiad IDs or videos are involved, and what you have already done. Do not try to fix it yourself by deleting logs or contacting anyone.' },
    { k: 'p', text: 'If you breach this handbook, Mittmee may, depending on how serious the breach is:' },
    { k: 'p', indent: 1, text: '• remove your access to the panel at once;' },
    { k: 'p', indent: 1, text: '• set aside and re-evaluate the marks you gave;' },
    { k: 'p', indent: 1, text: '• end your engagement, and withhold any fee for the affected work where your contract allows;' },
    { k: 'p', indent: 1, text: '• claim compensation for loss caused to Mittmee or to any child;' },
    { k: 'p', indent: 1, text: '• report the matter to the police or other authorities, including under the IT Act, 2000 and the POCSO Act, 2012.' },

    /* 11 */
    { k: 'chapter', n: 11, title: 'Acknowledgement and undertaking' },
    { k: 'p', text: 'I, the undersigned Evaluator, confirm that:' },
    ...EVALUATOR_HANDBOOK_UNDERTAKING.map((text, i) => ({ k: 'p' as const, indent: 1 as const, text: `${i + 1}. ${text}` })),
    { k: 'p', text: 'On the Mittmee portal this undertaking is given electronically: you sign it by ticking the declarations and clicking “I Accept” at your first login, and Mittmee records your name, Evaluator ID, and the date and time of acceptance in place of a signature.' },
  ],
};
