/**
 * Moderator Handbook – MITTMEE (internal).
 *
 * Source: "09 Moderator Handbook Internal.pdf". Wording is verbatim, including
 * the placeholders the source still leaves open ([Owner], [1.0], blanks in the
 * triage and escalation tables). Fill those in the source document first, then
 * mirror them here.
 *
 * Internal document: import this only from server code. It reaches the browser
 * through GET /api/staff/handbook, which admits the MODERATOR role only, so the
 * text never ships in a public JS bundle.
 *
 * Inline markup in text: <b>…</b>, <i>…</i>, <mark>…</mark> and
 * <a href="…">…</a>. Anything else is literal text.
 *
 * Section numbers: the PDF prints its headings without numbers, but its own
 * cross-references ("see Section 13", "Section 7.5") count them 1–15 in order,
 * so chapters carry that number.
 */

export type HandbookBlock =
  /** Chapter heading. `n` is omitted for the Appendix. */
  | { k: 'chapter'; n?: number; title: string; subtitle?: string; newPage?: boolean }
  /** Sub-heading inside a chapter (e.g. a violation category). */
  | { k: 'heading'; text: string }
  /** Paragraph. `indent` 1 = item under a lead-in line, 2 = example / quoted text. */
  | { k: 'p'; text: string; indent?: 0 | 1 | 2 }
  | { k: 'table'; head: string[]; rows: string[][]; cols?: string[] }
  /** Appendix remark template: a title and the template's lines. */
  | { k: 'template'; title: string; lines: string[] };

export interface Handbook {
  title: string;
  version: string;
  effectiveDate: string;
  blocks: HandbookBlock[];
}

const CODE_COLS = ['12%', '10%', '78%'];

export const MODERATOR_HANDBOOK: Handbook = {
  title: 'Moderator Handbook – MITTMEE',
  version: '[1.0]',
  effectiveDate: '[Effective Date]',
  blocks: [
    /* 1 */
    { k: 'chapter', n: 1, title: 'Purpose and who this handbook is for' },
    { k: 'p', text: 'This handbook applies to everyone who reviews content, handles user reports or takes action on accounts on MITTMEE ("moderators"), including senior moderators and the Child Safety Lead.' },
    { k: 'p', text: 'It is based on the following public documents, which users have agreed to. Moderators must apply them as written and must not create new rules:' },
    { k: 'p', indent: 1, text: 'Terms of Use, and Terms of Use for Children and Parent/Guardian Agreement' },
    { k: 'p', indent: 1, text: "Privacy Policy and Children's Privacy Policy" },
    { k: 'p', indent: 1, text: 'Community Guidelines (including the violation codes)' },
    { k: 'p', indent: 1, text: 'Copyright & IP Policy and Infringement Policy' },
    { k: 'p', text: 'If this handbook and a public document ever differ, the public document applies. Report the difference to [Owner] so this handbook can be corrected.' },

    /* 2 */
    { k: 'chapter', n: 2, title: 'Guiding principles' },
    { k: 'p', text: '<b>Children come first:</b> Many users are children, and every approved video can be seen by all users, including adults. Judge every video by asking: <i>*is this safe and suitable for a child to watch, and does it keep the child who posted it safe?*</i>' },
    { k: 'p', text: "<b>If in doubt, don't approve:</b> Reject with the closest code, or escalate. A wrongly rejected video can be re-uploaded; a wrongly approved one cannot be un-seen." },
    { k: 'p', text: '<b>Be consistent:</b> Apply the same code to the same kind of content, whoever posted it. Do not let personal opinions about talent, taste, religion, politics or background affect decisions.' },
    { k: 'p', text: '<b>Use the codes:</b> Every rejection, removal and account action must cite at least one violation code from the Community Guidelines. This keeps decisions consistent and lets users understand them.' },
    { k: 'p', text: '<b>Record everything:</b> Every decision must be logged as set out in Section 13.' },
    { k: 'p', text: "<b>Respect privacy:</b> You see personal data, including children's videos. Use it only for moderation (see Section 12)." },

    /* 3 */
    { k: 'chapter', n: 3, title: 'Roles' },
    {
      k: 'table', head: ['Role', 'Responsibilities'], cols: ['26%', '74%'],
      rows: [
        ['Moderator', 'Reviews the upload queue and user reports; approves or rejects with codes; escalates Tier 1 and Tier 2 cases.'],
        ['Senior Moderator', 'Decides escalated cases and all account actions (suspension, termination); reviews second opinions and user disputes; checks quality of decisions.'],
        ['Child Safety Lead', 'Handles all Tier 1 child-safety cases, reports to police under POCSO, and contacts parents in urgent cases.'],
        ['Grievance Officer', 'Handles formal grievances and infringement notices; directs takedowns and restorations under the Infringement Policy.'],
      ],
    },

    /* 4 */
    { k: 'chapter', n: 4, title: 'The review workflow' },
    { k: 'p', text: 'Every upload is reviewed before it goes live. No video may be approved without a moderator watching it in full.' },
    { k: 'p', text: 'Target review time:___ hours from upload. Olympiad entries near a deadline may be prioritised.' },
    { k: 'p', text: '<b>Review checklist:</b> For each video, check in this order:' },
    { k: 'p', indent: 1, text: "Account type. Note whether the uploader is an Adult User, Child User or Olympiad Participant. Take extra care with children's videos (personal information, state of dress, safety)." },
    { k: 'p', indent: 1, text: 'Watch the whole video with sound on. Check what is shown, said, sung and heard in the background, including anything visible behind the person (posters, screens, documents, windows showing the street).' },
    { k: 'p', indent: 1, text: 'Read the title, description and any on-screen text.' },
    { k: 'p', indent: 1, text: 'Check for personal information (Category 3): names, school, uniform, address, contact details.' },
    { k: 'p', indent: 1, text: "Check the profile if the video is the user's first upload or anything seems wrong (display name, bio, profile photo)." },
    { k: 'p', indent: 1, text: 'Decide: Approve, Reject (with codes) or Escalate.' },
    { k: 'p', text: 'Possible decisions:' },
    {
      k: 'table', head: ['Decision', 'When to use it', 'What happens'], cols: ['22%', '30%', '48%'],
      rows: [
        ['Approve', 'No violation found.', 'Video goes live.'],
        ['Reject', 'One or more violations under Tier 3 or 4 (see Section 6).', 'Video does not go live. User receives a remark with the code(s) and can fix and re-upload.'],
        ['Reject and escalate', 'Tier 2 violation.', 'Video does not go live. Senior Moderator reviews whether account action is needed.'],
        ['Hold and escalate urgently', 'Tier 1 violation or a child at risk.', 'Do <b>not</b> reject normally. Follow Section 7 immediately.'],
      ],
    },

    /* 5 */
    { k: 'chapter', n: 5, title: 'Writing remarks' },
    { k: 'p', text: "Every rejection or removal sends a remark to the user. For children's accounts, the parent or guardian also receives it with the code." },
    { k: 'p', text: 'Format:' },
    { k: 'p', indent: 2, text: 'Your video was not approved.' },
    { k: 'p', indent: 2, text: 'Reason: Code [code] – [violation name].' },
    { k: 'p', text: '<b>Rules for remarks:</b>' },
    { k: 'p', indent: 1, text: 'Quote every code that applies, in number order.' },
    { k: 'p', indent: 1, text: 'Use the exact violation name from the Community Guidelines.' },
    { k: 'p', indent: 1, text: 'Keep it short, polite and factual. For children, use simple, kind words.' },
    { k: 'p', indent: 1, text: 'Tell the user how to fix it where possible (for example, "Please blur the school badge and upload again").' },
    { k: 'p', indent: 1, text: '<b>Never</b> describe sexual or abusive content in detail in a remark.' },
    { k: 'p', indent: 1, text: "<b>Never</b> send a remark for Tier 1 cases without the Child Safety Lead's approval (see Section 7)." },
    { k: 'p', indent: 1, text: 'Do not mention who reported the video.' },
    { k: 'p', indent: 2, text: 'Examples:' },
    { k: 'p', indent: 2, text: '<b>Reason:</b> Code 5.5 – Unsafe activities without supervision. Experiments with fire need an adult to be seen supervising. You are welcome to film it again with an adult present.' },
    { k: 'p', indent: 2, text: "<b>Reason:</b> Code 14.2 – Poor quality. We couldn't see or hear the video clearly. Please try recording again in better light." },

    /* 6 */
    { k: 'chapter', n: 6, title: 'Code-by-code guidance', newPage: true },
    { k: 'p', text: 'Severity tiers. Every code has a tier that decides the action:' },
    {
      k: 'table', head: ['Tier', 'Meaning', 'Moderator action'], cols: ['21%', '29%', '50%'],
      rows: [
        ['Tier 1 – Critical', 'Serious harm or illegal content, especially involving children.', 'Hold the content, do not approve or delete it, and escalate <b>immediately</b> to the Child Safety Lead or Senior Moderator (Section 7). Likely account termination and reporting to authorities.'],
        ['Tier 2 – Serious', 'Serious violation that may need account action.', 'Reject with code and escalate to a Senior Moderator for account review.'],
        ['Tier 3 – Standard', 'Violation the user can usually fix.', 'Reject with code and a helpful remark.'],
        ['Tier 4 – Not a violation', 'Quality or relevance.', 'Reject with code and a helpful remark.'],
      ],
    },
    { k: 'p', text: 'If a video fits more than one code, apply the highest tier among them.' },
    { k: 'p', text: 'A pattern of repeated Tier 3 rejections from one account (for example, the same violation after being told how to fix it) should be escalated to a Senior Moderator.' },

    { k: 'heading', text: 'Category 1: Sexual content and nudity' },
    {
      k: 'table', head: ['Code', 'Tier', 'Guidance'], cols: CODE_COLS,
      rows: [
        ['1.1', '1', 'Any sexually explicit content. Hold and escalate. If a child may be involved, treat as 1.5.'],
        ['1.2', '2', 'Full or partial nudity. Classical, folk or sports costumes worn normally are not nudity. If the person is or may be a child, escalate as Tier 1.'],
        ['1.3', '2', 'Suggestive dancing, poses or clothing. Judge by what the video emphasises, not the dance style. Children imitating adult suggestive choreography: reject under 1.3 with a kind remark; escalate if an adult appears to be directing it (2.4).'],
        ['1.4', '3', 'Sexual jokes, lyrics or references, including in background songs.'],
        ['1.5', '1', 'Any sexualisation of a child. Hold and escalate to the Child Safety Lead immediately. Mandatory reporting (Section 7). Never download, copy or share the content.'],
      ],
    },
    { k: 'heading', text: 'Category 2: Child safety' },
    {
      k: 'table', head: ['Code', 'Tier', 'Guidance'], cols: CODE_COLS,
      rows: [
        ['2.1', '2', 'Child in underwear, bathing or changing, even if innocent or posted by a parent. Reject; escalate if the context is concerning.'],
        ['2.2', '2', 'Child put at risk (heights, traffic, water, fire, animals). If the child may be in current danger, escalate as Tier 1.'],
        ['2.3', '1', 'Any attempt to contact, meet or get information from a child. Usually an adult account. Hold and escalate; likely termination and police report.'],
        ['2.4', '1', 'Adult asking or encouraging a child to make a particular video. Hold and escalate.'],
        ['2.5', '2', 'Other content harmful or unsuitable for children. Name the concern in the log.'],
      ],
    },
    { k: 'heading', text: 'Category 3: Personal information and privacy' },
    {
      k: 'table', head: ['Code', 'Tier', 'Guidance'], cols: CODE_COLS,
      rows: [
        ['3.1', '3', 'Full name said or shown. First names alone are acceptable unless combined with other details that identify the person.'],
        ['3.2', '3', 'Address, house number, building or society name, street signs, or live location. Check backgrounds and windows.'],
        ['3.3', '3', 'Phone numbers, emails, social media handles or links.'],
        ['3.4', '3', 'Passwords, Olympiad IDs, login IDs or OTPs.'],
        ['3.5', '3', 'People shown without their agreement. Escalate as Tier 2 if the person appears unaware or distressed.'],
        ['3.6', '2', 'Filming in washrooms, changing rooms or similar private places. Escalate as Tier 1 if anyone is undressed.'],
        ['3.7', '3', 'Any other personal information of another person.'],
      ],
    },
    { k: 'heading', text: 'Category 4: Bullying, harassment and hate' },
    {
      k: 'table', head: ['Code', 'Tier', 'Guidance'], cols: CODE_COLS,
      rows: [
        ['4.1', '3', 'Mocking or humiliating a person. Friendly jokes between people clearly in on it are acceptable.'],
        ['4.2', '2', 'Threats of harm. Escalate as Tier 1 if the threat seems real or targets an identifiable child.'],
        ['4.3', '3', 'Body shaming.'],
        ['4.4', '2', 'Hate against any group.'],
        ['4.5', '3', 'Insulting or harassing a person on the basis of gender.'],
        ['4.6', '2', 'Promoting enmity between religions, castes or communities, or inciting violence.'],
      ],
    },
    { k: 'heading', text: 'Category 5: Violence and dangerous acts' },
    {
      k: 'table', head: ['Code', 'Tier', 'Guidance'], cols: CODE_COLS,
      rows: [
        ['5.1', '2', 'Blood, gore or real violence. Stage make-up or clearly pretend effects for a drama are acceptable if not frightening for young children.'],
        ['5.2', '3', 'Weapons. Traditional or cultural items used in a performance (for example, in a folk dance) are acceptable if not used to threaten.'],
        ['5.3', '3', 'Real fights. Supervised martial arts and sports are acceptable.'],
        ['5.4', '3', 'Stunts, challenges or pranks that could cause injury if copied. Escalate as Tier 2 if someone is actually hurt.'],
        ['5.5', '3', 'Fire, heat, sharp tools, chemicals or electricity used by a child without a visible adult.'],
        ['5.6', '2', 'Cruelty to animals.'],
        ['5.7', '3', 'Horror or scary content unsuitable for young children.'],
      ],
    },
    { k: 'heading', text: 'Category 6: Self-harm and wellbeing' },
    {
      k: 'table', head: ['Code', 'Tier', 'Guidance'], cols: CODE_COLS,
      rows: [
        ['6.1', '1', 'Self-harm or suicide content. Treat the uploader as possibly at risk: hold and escalate urgently to the Child Safety Lead (Section 7.5). Do not send a standard rejection remark.'],
        ['6.2', '2', 'Extreme dieting, starving or purging content. For a child uploader, escalate so a care-focused message can be sent to the parent.'],
      ],
    },
    { k: 'heading', text: 'Category 7: Drugs, alcohol and illegal activity' },
    {
      k: 'table', head: ['Code', 'Tier', 'Guidance'], cols: CODE_COLS,
      rows: [
        ['7.1', '3', 'Drinking or promoting alcohol. Adults in the background of a family event, not the focus, may be acceptable.'],
        ['7.2', '3', 'Smoking, tobacco, gutka or vaping.'],
        ['7.3', '2', 'Illegal drugs or misuse of medicines.'],
        ['7.4', '3', 'Gambling, betting or promoting money games.'],
        ['7.5', '2', 'Other illegal acts. Escalate as Tier 1 if a child is harmed or at risk.'],
      ],
    },
    { k: 'heading', text: 'Category 8: Language and behavior' },
    {
      k: 'table', head: ['Code', 'Tier', 'Guidance'], cols: CODE_COLS,
      rows: [
        ['8.1', '3', 'Swearing or abusive words, including in songs, captions and background audio.'],
        ['8.2', '3', 'Rude or obscene gestures.'],
      ],
    },
    { k: 'heading', text: 'Category 9: Copyright and intellectual property' },
    {
      k: 'table', head: ['Code', 'Tier', 'Guidance'], cols: CODE_COLS,
      rows: [
        ['9.1', '3', 'Copyrighted music.'],
        ['9.2', '3', 'Clips from films, TV, cartoons, games or other apps. Reject where the clip is the main content of the video.'],
        ['9.3', '3', "Someone else's artwork or photographs presented as the uploader's own, where this is obvious."],
        ['9.4', '3', "Re-upload of another user's video, where recognised. Escalate as Tier 2 if repeated."],
        ['9.5', '3', 'Brand names, logos or characters used to suggest endorsement. Incidental brands (a logo on a T-shirt) are acceptable.'],
      ],
    },
    { k: 'heading', text: 'Category 10: Authenticity' },
    {
      k: 'table', head: ['Code', 'Tier', 'Guidance'], cols: CODE_COLS,
      rows: [
        ['10.1', '2', 'Pretending to be a real person, official or another user. Clearly labelled parody or dress-up by a child is acceptable.'],
        ['10.2', '3', 'False information presented as fact (for example, a fake science claim that could cause harm).'],
        ['10.3', '2', 'AI-made or AI-altered content that makes something fake look real. <b>Tier 1</b> if it shows a real person without consent, or has any sexual element.'],
        ['10.4', '2', 'Signs of a false age or identity (for example, an adult on a child account, or a child on an adult account). Escalate for account review.'],
      ],
    },
    { k: 'heading', text: 'Category 11: Spam and commercial activity' },
    {
      k: 'table', head: ['Code', 'Tier', 'Guidance'], cols: CODE_COLS,
      rows: [
        ['11.1', '3', 'Advertising or selling.'],
        ['11.2', '3', 'Asking for money, gifts or donations. Escalate as Tier 2 if a child is being asked, or the request seems exploitative.'],
        ['11.3', '3', 'Promoting other apps, websites, channels or social media accounts.'],
        ['11.4', '3', 'Same or nearly the same video uploaded repeatedly.'],
      ],
    },
    { k: 'heading', text: 'Category 12: Misuse of the App' },
    {
      k: 'table', head: ['Code', 'Tier', 'Guidance'], cols: CODE_COLS,
      rows: [
        ['12.1', '2', "Signs of recording or downloading other users' videos (for example, a video that is a recording of another user's video). Escalate as Tier 1 if the recorded video is of a child and the uploader is an adult."],
        ['12.2', '2', "Sharing other users' videos outside the App, where reported."],
        ['12.3', '3', 'Re-upload of a rejected video with small changes. Escalate as Tier 2 if repeated.'],
        ['12.4', '2', "Using another person's account."],
        ['12.5', '2', 'Bots, scrapers, malware or hacking attempts. Also inform team.'],
        ['12.6', '3', 'Knowingly false or malicious reports. Record against the reporting account.'],
      ],
    },
    { k: 'heading', text: 'Category 13: Law, national security and public order' },
    {
      k: 'table', head: ['Code', 'Tier', 'Guidance'], cols: CODE_COLS,
      rows: [
        ['13.1', '1', 'Threats to the unity, integrity, security or sovereignty of India. Hold and escalate to the Senior Moderator and Grievance Officer.'],
        ['13.2', '2', 'Disturbing public order or inciting an offence.'],
        ['13.3', '3', 'Insulting another country or its people.'],
        ['13.4', '2', 'Any other violation of Indian law. Name the law if known in the log.'],
      ],
    },
    { k: 'heading', text: 'Category 14: Other reasons (not violations)' },
    {
      k: 'table', head: ['Code', 'Tier', 'Guidance'], cols: CODE_COLS,
      rows: [
        ['14.1', '4', 'Not related to creativity. Use sparingly: most everyday skills and hobbies count as creative.'],
        ['14.2', '4', 'Poor quality: blank, very dark, inaudible or incomplete.'],
        ['14.3', '4', 'Other. Always explain the reason in the remark.'],
      ],
    },

    /* 7 */
    { k: 'chapter', n: 7, title: 'Child safety and Tier 1 procedure', newPage: true },
    { k: 'p', text: 'Tier 1 cases include Codes 1.1, 1.5, 2.3, 2.4, 6.1, 13.1, and any other case where a child may be sexually exploited, groomed or in immediate danger.' },
    { k: 'p', text: 'What to do immediately:' },
    { k: 'p', indent: 1, text: 'Do not approve and do not delete the content. Mark it "Hold – Tier 1" in the moderation system so it is preserved.' },
    { k: 'p', indent: 1, text: "Do not download, screenshot, copy, forward or show the content to anyone, including colleagues, except through the moderation system's escalation function." },
    { k: 'p', indent: 1, text: 'Escalate at once to the Child Safety Lead (for child-related cases) or the Senior Moderator (for others), by [escalation channel]. For child-sexual-content cases, escalate within [15 minutes] of seeing the content, at any hour.' },
    { k: 'p', indent: 1, text: 'Suspend the uploading account if the system allows moderators to do so, or ask the Senior Moderator to do so.' },
    { k: 'p', indent: 1, text: 'Log the case with the code(s) and time, without describing the content in more detail than needed.' },
    { k: 'p', indent: 1, text: 'Do not contact the user.' },
    { k: 'p', text: 'Child Safety Lead actions:' },
    { k: 'p', indent: 1, text: 'Confirm the assessment.' },
    { k: 'p', indent: 1, text: 'Report to the police as required by law. Under the Protection of Children from Sexual Offences Act, 2012 and the POCSO Rules, 2020, material involving the sexual exploitation of a child must be reported to the Special Juvenile Police Unit or local police, or through the National Cyber Crime Reporting Portal (<a href="https://cybercrime.gov.in">cybercrime.gov.in</a>). Failure to report is itself an offence.' },
    { k: 'p', indent: 1, text: 'Preserve the content and associated records for the period required under the IT Rules (at least 180 days) or longer if required by the police or a court.' },
    { k: 'p', indent: 1, text: 'Terminate the account(s) involved, and any linked accounts.' },
    { k: 'p', indent: 1, text: 'Record every step taken.' },
    { k: 'p', text: "Grooming by adults (2.3, 2.4). Look for patterns: an adult account whose likes or shares focus heavily on children's videos, a profile or video inviting contact, or videos addressed to children. Escalate even if a single video seems harmless." },
    { k: 'p', text: 'A child at risk of self-harm or in danger (6.1, or disclosures of abuse).' },
    { k: 'p', text: 'Escalate urgently to the Child Safety Lead.' },
    { k: 'p', text: 'The Child Safety Lead contacts the parent or guardian using the registered contact details, in a calm and supportive way, unless the parent may be the source of harm.' },
    { k: 'p', text: 'If there is a risk to life or immediate danger, contact the police (112) and/or Childline (1098) straight away.' },
    { k: 'p', text: 'Do not send a standard rejection remark to the child.' },
    { k: 'p', text: 'Moderator wellbeing. Tier 1 content can be distressing. After handling it, you may take a break. Speak to if you need support.' },

    /* 8 */
    { k: 'chapter', n: 8, title: 'Handling user reports' },
    { k: 'p', text: 'Users report videos through the "Report" button or by email. Each report enters the reports queue with the reason chosen by the user.' },
    { k: 'p', text: 'Triage by tier:' },
    {
      k: 'table', head: ['Report concerns', 'Priority', 'Target time to act'], cols: ['48%', '20%', '32%'],
      rows: [
        ['Possible Tier 1 (sexual content, child at risk, grooming, self-harm)', 'Urgent', 'Immediately; follow Section 7'],
        ['Possible Tier 2', 'High', '____'],
        ['Possible Tier 3 or 4', 'Normal', '<mark>___</mark>'],
        ['Intimate or morphed images, impersonation (IT Rules categories)', 'Urgent', 'Within the timeline under the IT Rules'],
      ],
    },
    { k: 'p', text: 'Review the reported video afresh against the Community Guidelines. A report does not by itself mean a violation.' },
    { k: 'p', text: 'If a violation is found: remove the video (or the violating part), send a remark with the code(s), and escalate for account action if Tier 1 or 2.' },
    { k: 'p', text: 'If no violation is found: keep the video live and log "Report reviewed – no violation”.' },
    { k: 'p', text: 'Copyright reports made through the "Report" button should be forwarded to the Grievance Officer. Tell the reporter to use the Report Infringement page if they are the right owner.' },
    { k: 'p', text: 'False reports (12.6). Where a user repeatedly makes reports that are clearly false or malicious, log it against the reporting account and escalate.' },

    /* 9 */
    { k: 'chapter', n: 9, title: 'Infringement notices and takedowns' },
    { k: 'p', text: "Infringement notices are received by the Grievance Officer through the Report Infringement page or in writing, and handled under the Infringement Policy. Moderators act only on the Grievance Officer's instructions." },
    { k: 'p', text: '36-hour deadline. Once the Grievance Officer confirms a notice is complete, the takedown must be completed within 36 hours of receipt of the notice. Record the time of receipt and the time of takedown.' },
    { k: 'p', text: 'Partial or full takedown.' },
    { k: 'p', text: 'Where only the music or audio infringes: remove or mute the audio track and keep the video live.' },
    { k: 'p', text: 'Where a specific part infringes and can be cut: remove that part.' },
    { k: 'p', text: 'Otherwise: disable the whole video.' },
    { k: 'p', text: '<b>At the video\'s location,</b> display the notice: *"This content has been removed following a copyright complaint.”*' },
    { k: 'p', text: '<b>Inform the uploader</b> (and, for a child, the parent or guardian) using the takedown template in the Appendix, with Code 9.1 to 9.5 as applicable, and tell them how to respond.' },
    { k: 'p', text: '<b>21-day tracking.</b> The Grievance Officer tracks each notice for 21 days from the date of the notice:' },
    { k: 'p', indent: 1, text: 'If a court order is received: act as the order directs.' },
    { k: 'p', indent: 1, text: 'If no court order is received: the Grievance Officer decides whether to restore the content. If restored, inform the uploader.' },
    { k: 'p', text: '<b>Do not act on incomplete notices.</b> Return them to the Grievance Officer, who will ask the complainant for the missing details.' },
    { k: 'p', text: '<b>Orders from courts or the Government</b> under the IT Act are handled by the Grievance Officer and must be acted on within the time stated in the order.' },

    /* 10 */
    { k: 'chapter', n: 10, title: 'Account-level actions' },
    { k: 'p', text: 'Only a Senior Moderator (or the Child Safety Lead for Tier 1 child-safety cases) may suspend or terminate an account.' },
    { k: 'p', text: 'Available actions (Community Guidelines, Section C): reject or remove content; suspend the account for a period; permanently terminate the account.' },
    { k: 'p', text: 'Factors to consider: how serious the violation is (tier); whether the user has broken the rules before, including after being told how to fix a problem; the risk to other users, especially children; and whether the violation was deliberate.' },
    { k: 'p', text: 'Immediate termination is appropriate for Codes 1.1, 1.5, 2.3, 2.4, 10.3 (involving a real person without consent or sexual content) and 13.1, and for deliberate or repeated infringement of copyright.' },
    { k: 'p', text: "Children's accounts. Inform the parent or guardian of any suspension or termination, with the code(s). Use kind, non-blaming language." },
    { k: 'p', text: 'Record the reason for every account action, with the codes, so that it can be explained if the user raises a grievance.' },

    /* 11 */
    { k: 'chapter', n: 11, title: 'Olympiad entries' },
    { k: 'p', text: 'Olympiad entries are reviewed against the same Community Guidelines as other videos.' },
    { k: 'p', text: "Also check that the entry appears to be the Participant's own work (Children's Terms, Part C). Where it plainly is not reject under Code 9.2 or 9.4 and inform the Olympiad team." },
    { k: 'p', text: 'Decisions on eligibility, disqualification and results are made by the Olympiad team under the Olympiad Rules, not by moderators.' },

    /* 12 */
    { k: 'chapter', n: 12, title: 'Privacy and confidentiality for moderators' },
    { k: 'p', text: 'Moderators must:' },
    { k: 'p', indent: 1, text: 'access user data and videos only through the moderation system and only as needed to review;' },
    { k: 'p', indent: 1, text: 'never download, copy, screenshot or record any user content or personal data, or photograph the screen with a phone;' },
    { k: 'p', indent: 1, text: "never contact a user outside the App's official channels;" },
    { k: 'p', indent: 1, text: 'never discuss users or cases with anyone outside the moderation team, including family and friends, or post about them online;' },
    { k: 'p', indent: 1, text: 'use only company-approved devices, and lock screens when away;' },
    { k: 'p', indent: 1, text: 'report any suspected data breach (for example, data sent to the wrong person, or a lost device) to Data Protection contact <b>immediately</b>, so the company can meet its obligations under the DPDP Act and DPDP Rules.' },
    { k: 'p', text: 'Breach of these rules is serious misconduct and may lead to disciplinary action and legal liability.' },

    /* 13 */
    { k: 'chapter', n: 13, title: 'Record-keeping' },
    { k: 'p', text: 'Every decision must be logged in the moderation system with:' },
    {
      k: 'table', head: ['Field', 'Details'], cols: ['36%', '64%'],
      rows: [
        ['Video / account ID', 'System ID'],
        ['Account type', 'Adult User / Child User / Olympiad Participant'],
        ['Source', 'Upload review / User report / Infringement notice / Court or Government order'],
        ['Decision', 'Approved / Rejected / Removed (full or partial) / Held – Tier 1 / Escalated'],
        ['Code(s)', 'Every code that applies'],
        ['Tier', '1 to 4'],
        ['Remark sent', 'Text of the remark'],
        ['Escalated to', 'Name and time'],
        ['Account action', 'None / Suspension (period) / Termination'],
        ['Authority report', 'Whether reported, to whom, reference number'],
        ['Moderator', 'Name and date/time'],
      ],
    },
    { k: 'p', text: 'Logs and preserved content are kept for the periods set out in the Privacy Policy (Section 10) and the IT Rules.' },

    /* 14 */
    { k: 'chapter', n: 14, title: 'Disputes and grievances' },
    { k: 'p', text: 'If a user disputes a decision, a different moderator or a Senior Moderator reviews it afresh. If the original decision was wrong, reverse it and inform the user.' },
    { k: 'p', text: 'Formal grievances go to the Grievance Officer, who decides within the timelines under the IT Rules and the DPDP Rules. Provide the Grievance Officer with the log and your reasons on request.' },

    /* 15 */
    { k: 'chapter', n: 15, title: 'Escalation matrix' },
    {
      k: 'table', head: ['Situation', 'Escalate to', 'When'], cols: ['48%', '26%', '26%'],
      rows: [
        ['Sexual content involving a child (1.5), grooming (2.3, 2.4)', 'Child Safety Lead', 'Immediately'],
        ['Child at risk of self-harm or in danger (6.1)', 'Child Safety Lead', 'Immediately'],
        ['Pornography (1.1), threat to national security (13.1)', 'Senior Moderator', 'Immediately'],
        ['Any other Tier 2 violation', 'Senior Moderator', 'Same working day'],
        ['Repeated Tier 3 violations by one account', 'Senior Moderator', 'Same working day'],
        ['Infringement notice, court order or Government direction', 'Grievance Officer', 'Immediately on receipt'],
        ['Suspected data breach', '', 'Immediately'],
        ['Media or police enquiry', '', 'Immediately; do not respond yourself'],
        ['Unsure which code applies', 'Senior Moderator', 'Before deciding'],
      ],
    },

    /* Appendix */
    { k: 'chapter', title: 'Appendix', subtitle: 'Remark templates', newPage: true },
    {
      k: 'template', title: 'Rejection',
      lines: [
        'Your video was not approved.',
        'Reason: Code [code] – [violation name].',
        '[What to change.] You are welcome to upload it again once this is fixed. If you think we made a mistake, you can contact us at [email].',
      ],
    },
    {
      k: 'template', title: 'Rejection (child user)',
      lines: [
        "Your video wasn't approved this time.",
        'Reason: Code [code] – [violation name].',
        '[Simple, kind sentence on what to change.] Ask your parent or guardian to help you fix it and try again!',
      ],
    },
    {
      k: 'template', title: 'Notice to parent or guardian',
      lines: [
        'Dear Parent/Guardian,',
        "A video uploaded from your child's account ([display name]) was [not approved / removed] on [date].",
        'Reason: Code [code] – [violation name].',
        '[What to change.] You can read our Community Guidelines at [link]. If you have any questions or think we made a mistake, please write to [email].',
      ],
    },
    {
      k: 'template', title: 'Content removed after a report',
      lines: [
        'Your video has been removed.',
        'Reason: Code [code] – [violation name].',
        'If you think we made a mistake, you can contact us at [email].',
      ],
    },
    {
      k: 'template', title: 'Copyright takedown',
      lines: [
        'Your video has been [removed / had its audio removed] following a copyright complaint.',
        'Reason: Code [9.x] – [violation name].',
        'We received a notice from a person claiming to own the rights in [description of work]. If you believe this is a mistake, or that you have the right to use it, you can respond by [date] through [Settings > Support > Respond to takedown] or at [email]. Please see our Infringement Policy at [link].',
      ],
    },
    {
      k: 'template', title: 'Account suspension or termination',
      lines: [
        'Your account has been [suspended until (date) / permanently closed].',
        'Reason: Code(s) [codes] – [violation names].',
        'If you believe this is a mistake, you can raise a grievance with our Grievance Officer at [email].',
      ],
    },
  ],
};
