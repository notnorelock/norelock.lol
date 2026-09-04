import {
  IconBrandTypescript,
  IconBrowser,
  IconBug,
  IconCar,
  IconCode,
  IconDeviceGamepad2,
  IconMusic,
  IconNetwork,
  IconTerminal2,
  IconWorld,
} from '@tabler/icons-solidjs';
import { siApplemusic, siBandcamp, siGithub, siSoundcloud, siSpotify, siYoutube } from 'simple-icons';

export const profile = {
  name: 'norelock',
  domain: 'norelock.lol',
  birthday: '18 feb 2002',
  role: 'web / reverse engineer / music producer / developer',
  intro:
    "i'm from poland and i spend most of my time somewhere between making music, programming things and starting projects that are probably way bigger than they needed to be.",
  about: [
    "i don't really like describing myself as just a developer or just a producer. i've been doing both long enough that they're basically two sides of the same thing for me.",
    "sometimes i'm sitting in ableton at 3 am fixing a kick for the twentieth time. sometimes i'm staring at wireshark wondering why one packet decided to ruin my entire evening. sometimes i'm doing both.",
    "i don't have a grand philosophy behind any of it. usually something bothers me, interests me or just doesn't exist the way i wish it did. then i make a repository. then it's three months later and there's a backend, a custom protocol, a desktop client and seventeen services i absolutely did not plan.",
    "i like learning things by building them, and i don't mind throwing away an implementation when i realise there's a better way. i'm also incredibly good at turning this should be easy into a week-long engineering project.",
  ],
};

export const disciplines = [
  {
    value: 'web',
    title: 'web & realtime',
    eyebrow: '01 / build',
    icon: IconBrowser,
    copy:
      "typescript is where i feel most at home, but i've worked with c++, c#, lua, rust and whatever else a project needed. i'm much more interested in building actual systems than making another crud dashboard and calling it a day.",
    stack: ['solidjs', 'vue', 'typescript', 'go', 'redis', 'bun', 'postgresql', 'websocket'],
  },
  {
    value: 'music',
    title: 'music & sound',
    eyebrow: '02 / make noise',
    icon: IconMusic,
    copy:
      "i produce mostly in ableton and i don't like locking myself into one genre forever. releases so far: hellfire, arcadia, internal, in my dreams, sky, hyperarcadia and no memory, pt. 1.",
    stack: ['ableton live', 'sound design', 'mixing', 'audio'],
  },
];

export const capabilityCards = [
  {
    title: 'realtime web',
    icon: IconCode,
    text:
      'real-time networking, multiplayer synchronization, protocols, game clients, servers and software that talks to other software. usually the things that keep me interested.',
  },
  {
    title: 'tooling',
    icon: IconTerminal2,
    text:
      "not in the movie-hacker sense. i just like taking something apart to figure out how it works. memory structures, entity systems, hooks, and every weird decision made twenty years ago that you're now forced to understand.",
  },
];

export const projects = [
  {
    id: '01',
    title: 'summer hideout',
    type: 'game dev / networking + music',
    href: 'https://discord.gg/summer-hideout',
    description:
      "a story-driven game about building a car from the ground up and poking at things that should not be happening, set in the polish countryside around 2005. i handle the networking side — native multiplayer, keeping players in sync, the groundwork underneath it — and i write music for it too, which is the first time both halves of what i do have ended up in the same project.",
    stack: ['unity', 'c#', 'networking', 'multiplayer', 'soundtrack'],
    icon: IconCar,
  },
  {
    id: '02',
    title: 'vanta multiplayer',
    type: 'multiplayer / game tech',
    href: 'https://vantamp.xyz',
    description:
      "exists because at some point i looked at gta:sa multiplayer and thought okay, but what if we did this differently?. hooking into the game, synchronization, player state, entity management, launchers, and figuring out how a twenty-year-old game behaves internally. not meant to be another sa-mp clone — the interesting part is building the underlying tech and seeing how far it goes.",
    stack: ['c++', 'c#', 'typescript', 'networking'],
    icon: IconNetwork,
  },
  {
    id: '03',
    title: 'borealise',
    type: 'social music / realtime web',
    href: 'https://borealise.com',
    description:
      "started from missing the era when listening to music online actually felt social. not here’s a spotify link, listen later, but actually sitting in a room together, taking turns playing tracks, talking shit in chat. queues, djs, moderation, playlists. it’s one thing to make a project that works on localhost, another entirely to have real people using it.",
    stack: ['solidjs', 'vue', 'bun', 'postgresql', 'websocket'],
    icon: IconMusic,
  },
];

export const socialLinks = [
  {
    label: 'github',
    href: 'https://github.com/notnorelock',
    note: 'everything that made it out of the ideas folder',
    icon: siGithub,
  },
  {
    label: 'spotify',
    href: 'https://open.spotify.com/artist/02OqjxI5pv8HGiGQqNt38b',
    note: 'released tracks',
    icon: siSpotify,
  },
  {
    label: 'youtube',
    href: 'https://www.youtube.com/@norelock',
    note: 'music and videos',
    icon: siYoutube
  },
  {
    label: 'soundcloud',
    href: 'https://soundcloud.com/norelock/tracks',
    note: 'tracks, demos and rough versions',
    icon: siSoundcloud,
  },
  {
    label: 'apple music',
    href: 'https://music.apple.com/us/artist/norelock/1585433033',
    note: 'same releases, different store',
    icon: siApplemusic,
  },
  {
    label: 'bandcamp',
    href: 'https://norelock.bandcamp.com/',
    note: 'if you would rather actually own the music',
    icon: siBandcamp,
  },
];

export const stackBits = [
  { label: 'typescript', icon: IconBrandTypescript },
  { label: 'solidjs', icon: IconCode },
  { label: 'realtime networking', icon: IconNetwork },
  { label: 'reverse engineering', icon: IconBug },
  { label: 'music production', icon: IconMusic },
];
