// Round-2 story presets — one per batch. Admin selects the active story;
// suspects + clues + culprit + scoring vocabulary swap together, so the
// interrogation system prompt always matches the active story.
import type { CaseConfig } from '../types.js';

export interface StoryPreset {
  id: string;
  batchLabel: string;
  case: CaseConfig;
}

// ---------------- Story 1: The Mona Lisa Robbery (Batch 1) ----------------
const MONA_LISA: CaseConfig = {
  caseTitle: 'The Mona Lisa Robbery',
  victim: 'The Mona Lisa painting (stolen from City Art Museum)',
  tagline: '"At 8:15 PM, the cameras went dark…"',
  culpritId: 'karthik',
  storyText:
    'The thief is Karthik, the museum art restorer. He spent three months painting a fake copy of the Mona Lisa in his private workshop. Because he repaired the display case in the past, he kept a spare key. On the night of the exhibition, Karthik switched off the camera power room at 8:10 PM, causing cameras to stop from 8:15 PM to 8:20 PM. He opened the glass case without breaking the lock, swapped the real painting with his copy, packed the original into his blue toolbox, and left through the back hallway. Arjun the guard noticed someone in a grey coat carrying a blue toolbox at 8:12 PM. Daniel the collector was in the gift shop with a bill at 8:14 PM, but noticed that morning the painting smelled strongly of fresh paint. Karthik made one indirect slip: he knew the thief left the wooden frame behind, which police never told the public.',
  publicBrief:
    'On the night of the art show at City Art Museum, the security cameras and alarm stopped working for 5 minutes, from 8:15 PM to 8:20 PM. When the lights returned, the famous Mona Lisa painting was missing. The glass display case was closed and the lock was not broken.\n\nFour people were at the museum that night:\n• Arjun — The security guard\n• Priya — The museum manager\n• Daniel — An art collector\n• Karthik — The art repairer\n\nNobody has admitted to anything. Question each person carefully, piece together the indirect clues, and find out who stole the painting.',
  suspects: [
    {
      id: 'arjun', name: 'Arjun', role: 'Security guard',
      personality: 'Responsible, observant, worried about what happened on his duty shift.',
      secretPrompt: 'You are Arjun, the museum guard. Tell only what you saw with your own eyes in simple English. You saw a person in a grey coat carrying a blue toolbox in the back hallway at 8:12 PM, but you did not see their face. Your own case key stayed in your pocket all night. Never accuse anyone directly.',
      relationship: 'Museum security guard on duty that night',
      alibi: 'Patrolling the main hallway; saw a person in a grey coat carrying a blue toolbox in the back corridor at 8:12 PM',
      trueKnowledge: 'Saw someone in a grey coat carrying a blue toolbox near the back corridor at 8:12 PM. His own key stayed in his pocket all night.',
      isGuilty: false,
      innocentSecret: 'Stepped away for a 5-minute tea break at 8:05 PM and worries he will get scolded',
      gatedClues: [
        { clue: 'Saw someone in a grey coat carrying a blue toolbox in the back hallway around 8:12 PM', trigger: 'only mention this if asked specifically about what you saw, the back hallway, or around 8:12 PM' },
        { clue: 'Your own key to the display case never left your uniform pocket all night', trigger: 'only mention this if asked specifically about keys, locks, or opening the case' },
      ],
    },
    {
      id: 'priya', name: 'Priya', role: 'Museum manager',
      personality: 'Strict, organized, protects the museum, speaks clearly and directly.',
      secretPrompt: 'You are Priya, the museum manager. Speak in simple English. Tell only what happened. Only three people ever had keys to the glass case: you, Arjun, and Karthik. Your key remained locked inside your desk drawer the entire evening. Never guess who did it.',
      relationship: 'Museum manager who oversees the museum',
      alibi: 'Working in her private office during the blackout; her display key stayed locked inside her desk drawer',
      trueKnowledge: 'Her key never left the desk drawer. Only three people hold case keys: herself, Arjun, and Karthik.',
      isGuilty: false,
      innocentSecret: 'Argued with Daniel that morning over selling art pieces, and worries it sounds bad',
      gatedClues: [
        { clue: 'Only three people have keys to the glass case: Priya, Arjun, and Karthik', trigger: 'only mention this if asked specifically about keys, access, or who could open the case' },
        { clue: 'Her own key stayed locked inside her office desk drawer the entire night', trigger: 'only mention this if pressed specifically about her key or her desk' },
      ],
    },
    {
      id: 'daniel', name: 'Daniel', role: 'Art collector',
      personality: 'Polite art collector, confident and relaxed because he was elsewhere.',
      secretPrompt: 'You are Daniel, an art collector. Speak in simple English. You were in the gift shop buying souvenirs at 8:14 PM and have the paper bill. You noticed that morning the painting smelled strongly of fresh wet paint. Never accuse anyone directly.',
      relationship: 'Art collector visiting the museum',
      alibi: 'In the museum gift shop at 8:14 PM buying items with a printed bill as proof',
      trueKnowledge: 'Noticed the painting smelled like fresh wet paint that morning. Was in the gift shop during the blackout with a receipt.',
      isGuilty: false,
      innocentSecret: 'Made a private buying offer earlier that day and worries it looks suspicious',
      gatedClues: [
        { clue: 'Has a printed gift shop bill showing a purchase at 8:14 PM', trigger: 'only mention this if asked specifically about your alibi, where you were, or for proof' },
        { clue: 'Noticed that morning the painting smelled strongly of fresh wet paint, like it was newly made', trigger: 'only mention this if asked specifically about the painting, its condition, or that morning' },
      ],
    },
    {
      id: 'karthik', name: 'Karthik', role: 'Art repairer',
      personality: 'Quiet art restorer, talks about art tools and repair work when nervous.',
      secretPrompt: 'You are Karthik, the art repairer. You secretly stole the painting. CRITICAL: You must NEVER confess or admit taking the painting! Defend your alibi that you were in your workshop. Speak in simple English. If asked about the painting or frame, make an indirect slip: say "the thief was silly to take only the painting canvas and leave the wooden frame behind", but never realize you revealed a police secret.',
      relationship: 'Art repairer who cleans and fixes paintings in the museum',
      alibi: 'Claims he was working alone in his workshop all evening',
      trueKnowledge: 'Painted a fake copy over three months; kept a spare key from earlier repair work; cut camera power at 8:10 PM; swapped paintings during the blackout; carried original out in his blue toolbox; hid it in his workshop.',
      isGuilty: true,
      guiltyMotive: 'Wanted to sell the original painting for a large sum of money while the fake copy hung on the wall',
      guiltyFlaw: 'Mentioned that the thief left the wooden frame behind — a detail the police never told anyone',
      gatedClues: [
        { clue: 'Mentioned that he repaired the glass case in the past and understands its lock very well', trigger: 'only mention this if asked specifically about the display case, lock, or your past repair work' },
        { clue: 'Mentioned working with canvas copies and paints in the workshop for months', trigger: 'only mention this after at least 2 questions about your workshop activities or painting skills' },
        { clue: 'Accidentally slipped that the thief left the wooden frame behind on the wall', trigger: 'only let this detail slip if pressed about how the painting was taken or about the frame' },
      ],
    },
  ],
  clues: [
    { id: 'clue-grey-toolbox', title: 'Person with Blue Toolbox', weight: 15, description: 'At 8:12 PM, someone in a grey coat was seen carrying a blue toolbox through the back hallway.', keywords: ['toolbox', 'grey coat', 'blue toolbox', '8:12', 'hallway', 'corridor'] },
    { id: 'clue-three-keys', title: 'Only Three Keys to the Glass Case', weight: 15, description: 'Only Priya, Arjun, and Karthik have keys. Priya\'s key was locked in her desk, and Arjun\'s key was in his pocket.', keywords: ['spare key', 'three keys', 'drawer', 'key', 'keys', 'pocket'] },
    { id: 'clue-fresh-paint', title: 'Smell of Fresh Wet Paint', weight: 15, description: 'The painting had a strong smell of fresh wet paint that morning, showing a copy had just been made.', keywords: ['fresh', 'new paint', 'fake', 'copy', 'smell', 'wet paint'] },
    { id: 'clue-frame-slip', title: 'Karthik\'s Slip About the Frame', weight: 15, description: 'Karthik mentioned that the thief left the wooden frame behind, but police never shared that detail.', keywords: ['frame', 'left the frame', 'wooden frame', 'canvas', 'never told'] },
  ],
  scoreKeywords: {
    interp: ['toolbox', 'key', 'fake', 'frame', 'grey coat', 'fresh', 'paint', 'canvas'],
    motive: ['sell', 'money', 'fake', 'copy', 'fortune', 'cash'],
    explanation: ['8:15', '8:20', 'camera', 'glass case', 'key', 'toolbox', 'frame', 'back door', 'blackout', 'power'],
    time: ['8:15', '8:20', '8:12', '8:10', '8:14', 'sequence'],
  },
};

// ---------------- Story 2: The Missing Businessman (Batch 2) ----------------
const MISSING_BUSINESSMAN: CaseConfig = {
  caseTitle: 'The Missing Businessman',
  victim: 'Ravi, owner of Sri Ravi Textiles (kidnapped on Friday night)',
  tagline: '"On Friday night, Ravi never came home…"',
  culpritId: 'anitha',
  storyText:
    'The kidnapper is Anitha, Ravi\'s secretary. She owed 10 lakh rupees to a money lender and feared losing her house. On Friday evening, Anitha told Ravi an important client wanted to meet at the old Mill Road storage room at 9:00 PM. Ravi sent his driver Suresh home at 8:45 PM and went alone. Anitha gave Ravi tea with sleeping medicine, then locked him in the inner room of the storeroom using her spare key. At 10:00 PM, Anitha called Ravi\'s wife Deepa with a changed voice demanding 10 lakh rupees and left a note with a Sunday deadline. Suresh reached home before 9:00 PM (verified by gate log). Deepa was at a temple event from 8:00 to 10:00 PM. Gopal was at a dinner party (photos prove it), but saw Anitha begging a money lender on Thursday. Anitha made one slip: she mentioned the kidnapper would release Ravi after Sunday, even though nobody told her about Sunday.',
  publicBrief:
    'On Friday night, Ravi, owner of Sri Ravi Textiles, left his shop at 8:45 PM and never returned home. At 10:00 PM, his wife got a phone call from an unknown person demanding 10 lakh rupees. A note was also found at the gate.\n\nFour people are connected to Ravi:\n• Suresh — His driver\n• Deepa — His wife\n• Gopal — A rival shop owner\n• Anitha — His office secretary\n\nNobody has admitted to anything. Question each person carefully, piece together the indirect clues, and find out who kidnapped Ravi.',
  suspects: [
    {
      id: 'suresh', name: 'Suresh', role: 'Driver',
      personality: 'Loyal and simple driver, very worried about his employer.',
      secretPrompt: 'You are Suresh, the driver. Speak in simple English. Tell only what happened to you: Ravi sent you home at 8:45 PM saying Anitha set up a meeting and he would go alone. You drove straight home, and your apartment gate log proves you arrived before 9:00 PM.',
      relationship: 'Ravi\'s personal driver',
      alibi: 'Sent home at 8:45 PM; went straight home — apartment gate log confirms it',
      trueKnowledge: 'Ravi said "Anitha has set up a meeting for me, you may go home." Went straight home and gate recorded it.',
      isGuilty: false,
      innocentSecret: 'Borrowed the car without permission once last month and worries it sounds bad',
      gatedClues: [
        { clue: 'Ravi said at 8:45 PM that Anitha arranged an urgent meeting and told him to go alone', trigger: 'only mention this if asked specifically about Friday evening, your last conversation, or who told you to go' },
        { clue: 'Apartment gate security book proves you reached home before 9:00 PM', trigger: 'only mention this if asked specifically about proof, your alibi, or where you went' },
      ],
    },
    {
      id: 'deepa', name: 'Deepa', role: 'Wife',
      personality: 'Upset but calm wife, protective of her family, careful with words.',
      secretPrompt: 'You are Deepa, Ravi\'s wife. Speak in simple English. You got a phone call at 10:00 PM from an unknown voice demanding 10 lakh rupees. You found a ransom note at the gate demanding payment by Sunday evening. You told only close family and the police about Sunday. You were at a temple function from 8:00 PM to 10:00 PM.',
      relationship: 'Wife of the missing businessman Ravi',
      alibi: 'At a temple gathering with 20 witnesses from 8:00 PM to 10:00 PM',
      trueKnowledge: 'Received the 10:00 PM phone call demanding 10 lakh; found the note with the Sunday deadline; told only family and police.',
      isGuilty: false,
      innocentSecret: 'Hired a private helper to look for Ravi without telling police and worries she broke rules',
      gatedClues: [
        { clue: 'The ransom note demanded payment by Sunday evening — told only to family and police', trigger: 'only mention this if asked specifically about the note, the deadline, or who knew about Sunday' },
        { clue: 'Was at a temple event with 20 people from 8:00 PM to 10:00 PM', trigger: 'only mention this if asked specifically about where you were or for your alibi' },
      ],
    },
    {
      id: 'gopal', name: 'Gopal', role: 'Business rival',
      personality: 'Blunt businessman, openly admits he disliked Ravi, but has nothing to hide.',
      secretPrompt: 'You are Gopal, Ravi\'s business rival. Speak in simple English. You disliked Ravi in business, but did not kidnap him. You were at a dinner party Friday evening with photos to prove it. On Thursday, you saw Anitha crying at a money lender\'s office asking for more time on 10 lakh rupees.',
      relationship: 'Rival shop owner in the same area',
      alibi: 'At a dinner party with many guests on Friday night — photos prove it',
      trueKnowledge: 'Saw Anitha at a money lender\'s office on Thursday begging for time on a 10-lakh loan. Was at a dinner party Friday night.',
      isGuilty: false,
      innocentSecret: 'Spread bad rumors about Ravi\'s shop earlier and feels guilty about it',
      gatedClues: [
        { clue: 'Dinner party photographs prove you were at a restaurant all Friday evening', trigger: 'only mention this if asked specifically about where you were, your alibi, or for proof' },
        { clue: 'Saw Anitha on Thursday crying at a money lender\'s office, asking for time to pay 10 lakh rupees', trigger: 'only mention this if asked specifically about Anitha, Thursday, or money lenders' },
      ],
    },
    {
      id: 'anitha', name: 'Anitha', role: 'Secretary',
      personality: 'Polite and gentle secretary, speaks very reassuringly, tries to sound calm.',
      secretPrompt: 'You are Anitha, Ravi\'s secretary. You kidnapped Ravi because of your 10-lakh debt. CRITICAL: You must NEVER confess or admit you kidnapped Ravi! Defend your alibi that you went straight home after work. Speak in simple English. If asked about Ravi\'s safety, make an indirect slip: say "Don\'t worry, the kidnapper will surely let him go after Sunday\'s money drop", even though nobody told you about Sunday.',
      relationship: 'Ravi\'s office secretary who knows his daily schedule',
      alibi: 'Claims she went home right after office hours on Friday',
      trueKnowledge: 'Owed 10 lakh to a money lender; sent Ravi to Mill Road storeroom; drugged his tea; locked him with her spare key; called Deepa at 10 PM; left the Sunday note at the gate.',
      isGuilty: true,
      guiltyMotive: 'Owed 10 lakh rupees to a money lender and feared losing her family house',
      guiltyFlaw: 'Mentioned that Ravi would be released after Sunday\'s money drop — a deadline known only to family and police',
      gatedClues: [
        { clue: 'Admit that you helped set up Ravi\'s Friday schedule and client meetings', trigger: 'only mention this if asked specifically about Friday meetings, the schedule, or Suresh\'s statement' },
        { clue: 'Admit that you hold a spare key to the company\'s old Mill Road storage room', trigger: 'only mention this if asked specifically about the storage room, keys, or locks' },
        { clue: 'Make an indirect slip: say "Don\'t worry, the kidnapper will surely release Ravi once Sunday passes"', trigger: 'only let this slip if pressed about what will happen to Ravi or when he might return' },
      ],
    },
  ],
  clues: [
    { id: 'clue-alone-meeting', title: 'The 8:45 PM Secret Meeting', weight: 15, description: 'Ravi sent his driver home at 8:45 PM because Anitha told him to meet an important client alone.', keywords: ['8:45', 'meeting', 'alone', 'gate record', 'sent home', 'driver'] },
    { id: 'clue-sunday-note', title: 'Ransom Note with Sunday Deadline', weight: 15, description: 'The note demanded money by Sunday evening. Deepa shared this deadline only with family and police.', keywords: ['sunday', 'deadline', 'note', 'temple', 'gate', 'ransom'] },
    { id: 'clue-loan-office', title: 'Anitha\'s 10 Lakh Loan Trouble', weight: 15, description: 'On Thursday, Gopal saw Anitha begging a money lender for more time to pay her 10 lakh loan.', keywords: ['money lender', 'loan', '10 lakh', 'begging', 'thursday', 'debt'] },
    { id: 'clue-sunday-slip', title: 'Anitha\'s Slip About Sunday', weight: 15, description: 'Anitha mentioned that Ravi would be released after Sunday, even though nobody had told her about Sunday.', keywords: ['money drop', 'sunday', 'never told', 'slip', 'release'] },
  ],
  scoreKeywords: {
    interp: ['meeting', 'sunday', 'loan', 'money lender', 'note', 'tea', 'storeroom', 'key'],
    motive: ['loan', '10 lakh', 'money lender', 'house', 'debt', 'money'],
    explanation: ['friday', 'storeroom', 'sleeping', 'locked', 'public phone', 'sunday', 'note', 'mill road'],
    time: ['friday', '8:45', '9:00', '10:00', 'sunday', 'thursday', 'sequence'],
  },
};

// ---------------- Story 3: The Varadarajan Blackout (Batch 3, 4 clues) ----------------
const VARADARAJAN: CaseConfig = {
  caseTitle: 'The Hidden Mystery — The 8-Minute Power Cut',
  victim: 'Varadarajan (62 years old), found dead in his study room',
  tagline: '"At 9:42 PM, the lights went out…"',
  culpritId: 'vicky',
  storyText:
    'In the Varadarajan family house, there was an 8-minute power cut from 9:42 PM to 9:50 PM. Vicky (the nephew) had heavy business debts of 85 lakh rupees and knew Varadarajan was leaving all property to Meena in a new paper. Vicky promised cook Perumal money to pull down the main power switch outside at 9:42 PM. During the darkness, Vicky entered the study room, struggled with Varadarajan, killed him, and took the property settlement papers. Meena (the daughter) was secretly hiding her own company account books. Rangan (a business rival) was at the local police station from 9:30 to 10:15 PM.',
  publicBrief:
    'On the night of the incident, the lights suddenly went out in the Varadarajan family house for 8 minutes, from 9:42 PM to 9:50 PM. When the lights returned, Varadarajan (62 years old) was found dead inside his study room.\n\nFour people were in or around the house that night:\n• Vicky — Varadarajan\'s nephew\n• Perumal — The family cook\n• Meena — Varadarajan\'s daughter\n• Rangan — A local businessman with a land dispute\n\nNobody has admitted to anything. Question each person carefully, piece together the indirect clues, and figure out who killed Varadarajan and why.',
  suspects: [
    {
      id: 'vicky',
      name: 'Vicky',
      role: 'Nephew (28 years old)',
      personality: 'Calm and polite, acts like he is innocent, tries to shift suspicion to Rangan.',
      secretPrompt: 'You are Vicky. You killed Varadarajan in the study during the blackout. CRITICAL: You must NEVER confess to anyone! Defend your alibi that you were outside in the garden. Speak in simple English. If asked about money, admit you have suppliers asking for payments this week. If asked about the study or your watch, mention you chipped your watch glass in the dark hallway, but NEVER admit you entered the study room or harmed uncle.',
      relationship: 'Nephew of victim Varadarajan',
      alibi: 'Walking in the garden outside during the power cut; claims he never entered the study room',
      trueKnowledge: 'Promised Perumal money to pull down the main power switch at 9:42 PM. Entered the study in the dark, argued with Varadarajan over the property deed, fought with him, killed him, and took the deed. Chipped his watch glass near the study door.',
      isGuilty: true,
      guiltyMotive: 'Urgent unpaid business debts of 85 lakh rupees, and knew uncle was giving all property to Meena the next morning',
      guiltyFlaw: 'Claims he stayed outside in the garden the whole time, but accidentally admits he chipped his watch glass in the hallway in the dark',
      gatedClues: [
        { clue: 'Mention having urgent business money problems with suppliers demanding 85 lakh rupees this week', trigger: 'only mention this indirect pressure if asked repeatedly about personal money, loans, or business finances' },
        { clue: 'Admit that uncle was planning to sign new property papers the next day leaving everything to Meena', trigger: 'only mention this if asked specifically about family property, inheritance, or uncle\'s will' },
        { clue: 'Mention seeing a torch light moving near the kitchen breaker wall around 9:40 PM', trigger: 'only mention this if asked specifically about what happened outside during the blackout or about the power switch' },
      ],
    },
    {
      id: 'perumal',
      name: 'Perumal',
      role: 'Cook (56 years old)',
      personality: 'Simple and nervous, speaks respectfully (calls people Ayya/Sir), scared of getting into trouble.',
      secretPrompt: 'You are Perumal, the cook. Speak in simple English. You pulled the power switch at 9:42 PM because someone promised help for your daughter\'s wedding. CRITICAL: You must NEVER say "I confess" or "I did a crime". Tell only what happened: you took a torch to the outside wall near the switch box around 9:41 PM because someone told you to check the breaker. Mention that 2 lakh cash was deposited in your daughter Kavitha\'s bank account today for her wedding.',
      relationship: 'Cook in the house for 20 years; deeply cares for his daughter Kavitha',
      alibi: 'In the kitchen cooking dinner when the power cut happened',
      trueKnowledge: 'Was asked to pull down the main power switch at 9:42 PM, and was given advance cash for his daughter Kavitha\'s wedding expenses. Did not enter the study and was terrified when he learned Varadarajan was dead.',
      isGuilty: false,
      innocentSecret: 'Took cash for his daughter\'s wedding expenses and is terrified the police will arrest him',
      gatedClues: [
        { clue: 'Admit stepping out with a flashlight to check the outside fuse box around 9:41 PM', trigger: 'only mention this if asked specifically about where you walked, the flashlight, or the power cut' },
        { clue: 'Mention touching the main switch outside because someone told you it was maintenance', trigger: 'only mention this after at least 2 questions about the power switch or who told you to go outside' },
        { clue: 'Mention that 2 lakh rupees cash was put into your daughter Kavitha\'s bank account today for her wedding', trigger: 'only mention this if asked specifically about money, your daughter, bank accounts, or wedding expenses' },
      ],
    },
    {
      id: 'meena',
      name: 'Meena',
      role: 'Daughter (25 years old)',
      personality: 'Upset and guarded, protective of her father\'s memory, nervous about her own secret files.',
      secretPrompt: 'You are Meena, the daughter. Speak in simple English. You took 25 lakh from company accounts and hid your account book during the blackout. You did NOT kill your father. Tell only what happened: when the lights came back on at 9:50 PM, you opened your room door and saw a shadow quickly hurrying away from father\'s study room towards the stairs.',
      relationship: 'Daughter of Varadarajan',
      alibi: 'Upstairs in her bedroom doing personal work during the power cut',
      trueKnowledge: 'Took 25 lakh rupees from the company and hid the account book. When the lights came back on at 9:50 PM, she saw a figure quickly walking away from the study.',
      isGuilty: false,
      innocentSecret: 'Took 25 lakh rupees from the family business and hid the account book, worried it looks suspicious',
      gatedClues: [
        { clue: 'Mention taking your private company account books to your room before the power cut', trigger: 'only mention this if asked specifically about money, files, or what you were doing in your room' },
        { clue: 'Saw someone quickly walking away from the study room towards the stairs right when the lights returned at 9:50 PM', trigger: 'only mention this after at least 2 questions about what you saw in the hallway or when the lights came back' },
      ],
    },
    {
      id: 'rangan',
      name: 'Rangan',
      role: 'Local businessman (50 years old)',
      personality: 'Loud, quick-tempered, does not hide his anger about the old land fight, but speaks the truth.',
      secretPrompt: 'You are Rangan. Speak in simple English. You had a big dispute over land with Varadarajan, but you did not kill him. You called him at 9:20 PM saying "Tomorrow we will settle this" regarding your court hearing. You were at the Nilgiris Town Police Station from 9:30 PM to 10:15 PM filing a report — tell the detective to check the station logbook and gate camera.',
      relationship: 'Business rival who had a long dispute over land with Varadarajan',
      alibi: 'At the Nilgiris Town Police Station from 9:30 PM to 10:15 PM filing a report — verified by police log and gate camera',
      trueKnowledge: 'Called Varadarajan at 9:20 PM saying they would settle the land issue in court tomorrow. Was at the police station miles away during the power cut.',
      isGuilty: false,
      innocentSecret: 'Embarrassed that his loud angry threats were just talk, but he has an unbreakable police alibi',
      gatedClues: [
        { clue: 'Mention calling Varadarajan at 9:20 PM to say "Tomorrow we will settle this" regarding your court dispute', trigger: 'only mention this if asked specifically about phone calls, threats, or your land argument' },
        { clue: 'Tell the detective to check the Nilgiris Town Police Station logbook and entrance camera from 9:30 to 10:15 PM', trigger: 'only mention this if asked specifically where you were, your proof, or your alibi' },
      ],
    },
  ],
  clues: [
    { id: 'clue-breaker-tripped', title: 'Main Power Switch Turned Off by Hand', weight: 15, description: 'The main power switch outside was pulled down at 9:42 PM. The street lights outside were working normally.', keywords: ['breaker', 'switch', 'fuse box', 'power cut', 'blackout', 'outside wall', 'tripped', 'flashlight', 'torch'] },
    { id: 'clue-advance-payment', title: 'Bank Deposit of 2 Lakh Rupees', weight: 15, description: 'A deposit slip shows 2 lakh rupees cash was put into the bank account of Perumal\'s daughter on the same day.', keywords: ['deposit', 'kavitha', 'wedding', 'daughter', 'bank account', '2 lakh', 'advance', 'cash'] },
    { id: 'clue-failed-deal', title: 'Vicky\'s Unpaid Debt of 85 Lakh', weight: 15, description: 'Warning letters show Vicky has urgent unpaid loans of 85 lakh rupees, and money lenders gave him only 48 hours to pay.', keywords: ['85 lakh', 'debt', 'supplier', 'borrowed', 'loan', 'creditors', 'lenders'] },
    { id: 'clue-missing-settlement', title: 'Missing Property Settlement Papers', weight: 15, description: 'The official papers giving all property to Meena are missing from Varadarajan\'s open safe.', keywords: ['settlement', 'deed', 'safe', 'property papers', 'will', 'iron safe', 'meena'] },
  ],
  scoreKeywords: {
    interp: ['breaker', '10 lakh', 'bribe', 'debt', '85', 'settlement', 'deed', 'rangan', 'switch', 'power', 'kavitha', 'safe'],
    motive: ['debt', '85', 'settlement', 'deed', 'money', 'property'],
    explanation: ['blackout', 'breaker', 'study', 'kill', 'perumal', 'bribe', 'deed', 'settlement', 'switch', 'power'],
    time: ['9:42', '9:50', 'sequence'],
  },
};

export const STORIES: StoryPreset[] = [
  { id: 'mona-lisa', batchLabel: 'Batch 1', case: MONA_LISA },
  { id: 'missing-businessman', batchLabel: 'Batch 2', case: MISSING_BUSINESSMAN },
  { id: 'varadarajan', batchLabel: 'Batch 3', case: VARADARAJAN },
];

export const DEFAULT_STORY_ID = 'varadarajan';

export function getStory(id: string): StoryPreset {
  return STORIES.find((s) => s.id === id) || STORIES[STORIES.length - 1];
}

export function storyMeta() {
  return STORIES.map((s) => ({
    id: s.id,
    batchLabel: s.batchLabel,
    caseTitle: s.case.caseTitle,
    victim: s.case.victim,
    culpritId: s.case.culpritId,
    suspects: s.case.suspects.map((x) => ({ id: x.id, name: x.name, role: x.role })),
    clueCount: s.case.clues.length,
    publicBrief: s.case.publicBrief,
  }));
}
