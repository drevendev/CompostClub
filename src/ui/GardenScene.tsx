export function GardenScene({
  growing,
  count,
  ready,
}: {
  growing: boolean;
  count: number;
  ready: number;
}) {
  return (
    <div
      className={`garden-scene ${growing ? 'is-growing' : ''}`}
      role="img"
      aria-label={`A cozy compost garden with a friendly worm. ${count} sprouts grown, ${ready} pairings ready.`}
    >
      <svg viewBox="0 0 600 390" aria-hidden="true">
        <defs>
          <radialGradient id="sky">
            <stop stopColor="#edeecf" />
            <stop offset="1" stopColor="#e7ebdc" />
          </radialGradient>
          <linearGradient id="wood" x2="0" y2="1">
            <stop stopColor="#a16a48" />
            <stop offset="1" stopColor="#805239" />
          </linearGradient>
          <pattern id="soil" width="26" height="24" patternUnits="userSpaceOnUse">
            <circle cx="7" cy="7" r="1.5" fill="#b99f7c" />
            <path d="m17 17 3-1" stroke="#8b7657" strokeWidth="2" />
          </pattern>
          <filter id="soft">
            <feGaussianBlur stdDeviation="4" />
          </filter>
        </defs>
        <path
          d="M39 270C0 202 34 96 105 64 181 30 255 72 312 51c91-33 201-10 235 73 30 72-2 164-82 184Z"
          fill="url(#sky)"
        />
        <circle cx="452" cy="94" r="31" fill="#e9c66d" opacity=".85" />
        <g className="cloud" fill="#fbfaf0" opacity=".85">
          <path d="M85 120c-15-2-13-19 0-20 3-20 30-24 37-4 21-8 31 20 10 24Z" />
          <path d="M322 88c-10 0-11-12 0-15 6-19 28-14 28 0 15-4 21 14 5 15Z" />
        </g>
        <path
          d="M35 278c53-42 116-54 184-31 75-50 170-46 238-6 41-8 76-2 111 29-64 46-465 72-533 8Z"
          fill="#cbd4b5"
        />
        <path d="M56 291c116-52 373-46 494 4-80 49-414 52-494-4Z" fill="#b3c29a" />
        <ellipse
          cx="303"
          cy="308"
          rx="152"
          ry="27"
          fill="#8a7958"
          opacity=".16"
          filter="url(#soft)"
        />
        <path d="M165 289c32-36 196-47 261-6l-11 35c-68 22-190 21-247-4Z" fill="#bdaa86" />
        <path d="M165 289c32-36 196-47 261-6l-11 35c-68 22-190 21-247-4Z" fill="url(#soil)" />
        <g
          className="steam"
          fill="none"
          stroke="#98a482"
          strokeWidth="3"
          strokeLinecap="round"
          opacity=".65"
        >
          <path d="M260 153c-15-17 15-23 0-41" />
          <path d="M301 138c-14-17 14-28 0-44" />
          <path d="M340 153c-14-18 14-29 1-43" />
        </g>
        <g transform="rotate(-12 247 184)">
          <rect
            className="paper-float"
            x="221"
            y="137"
            width="50"
            height="68"
            rx="2"
            fill="#f5e7b7"
            stroke="#bfae7e"
          />
          <path d="M232 151h26M232 159h26M232 167h18" stroke="#b6a57d" strokeWidth="2" />
        </g>
        <g transform="rotate(16 342 172)">
          <path d="M316 129h49v66h-49Z" fill="#ead2bd" stroke="#bfa48c" />
          <path d="M327 143h26M327 151h26M327 159h15" stroke="#b49c87" strokeWidth="2" />
        </g>
        <path d="M205 195c8-48 44-35 57-50 17-20 49-5 59 3 37-3 65 14 74 46Z" fill="#64543a" />
        <path
          d="M223 181c18-13 30-2 39-13 14-13 26 10 41-1 23-18 39 15 57 4l18 21H216Z"
          fill="#85724c"
        />
        <g stroke="#4d633f" strokeWidth="3" fill="#6d884e">
          <path d="M295 159v-38c-15 3-24-6-25-18 20-4 29 8 25 18 0-22 13-31 28-29 3 18-9 30-28 29" />
        </g>
        <path d="m196 194 14 102 179-1 14-102Z" fill="#76513a" stroke="#634732" strokeWidth="2" />
        <g fill="url(#wood)" stroke="#634732" strokeWidth="2">
          <path d="m198 198 202-1-4 27-194 2Z" />
          <path d="m202 232 193-2-4 27-185 2Z" />
          <path d="m207 264 183-2-4 29-175 1Z" />
        </g>
        <g fill="#b68158" stroke="#634732" strokeWidth="2">
          <path d="m199 189 16-1 13 110-17 2Z" />
          <path d="m383 190 17 1-14 108-17-1Z" />
        </g>
        <g stroke="#c79264" opacity=".55" fill="none">
          <path d="M230 211c31-8 47 6 74-1s45 5 71-1M231 244c31-8 47 6 74-1s45 5 71-1M233 277c31-8 47 6 74-1s45 5 71-1" />
        </g>
        <g fill="#503e2f">
          <circle cx="209" cy="207" r="2" />
          <circle cx="214" cy="243" r="2" />
          <circle cx="218" cy="281" r="2" />
          <circle cx="389" cy="206" r="2" />
          <circle cx="385" cy="242" r="2" />
          <circle cx="380" cy="280" r="2" />
        </g>
        <rect
          x="267"
          y="219"
          width="64"
          height="47"
          rx="4"
          transform="rotate(-4 299 242)"
          fill="#ecdfbc"
          stroke="#baa17c"
        />
        <g stroke="#617b4d" strokeWidth="2.5" fill="#8ca16c">
          <path d="M299 254v-23M299 244c-12 1-16-7-15-12 12-2 18 4 15 12M299 237c0-12 10-16 17-14 0 10-7 16-17 14" />
        </g>
        <g transform="translate(125 251)">
          <path d="M0 48V14" stroke="#708448" strokeWidth="3" />
          <path
            d="M0 37c-18 3-23-10-21-19C-4 16 4 27 0 37M0 27C0 11 12 6 22 8c1 16-9 23-22 19"
            fill="#88a365"
          />
          <circle cy="8" r="10" fill="#d2a963" />
          <circle cy="8" r="4" fill="#9d7951" />
        </g>
        <g transform="translate(439 267)">
          <path
            d="m0 35 1-25M1 26C-13 30-21 20-19 11-6 9 4 17 1 26M1 20C1 7 12 1 21 3c2 13-7 20-20 17"
            fill="#68824b"
            stroke="#5f7546"
            strokeWidth="2"
          />
        </g>
        <g transform="translate(398 310)">
          <path d="M0-1v-22M21 0v-13" stroke="#efe2c4" strokeWidth="7" />
          <path d="M-15-18C-15-45 16-45 16-18Z" fill="#b97153" />
          <path d="M10-11c0-18 24-21 26-1Z" fill="#c78960" />
          <g fill="#f5dfb6">
            <circle cx="-4" cy="-28" r="3" />
            <circle cx="7" cy="-24" r="2" />
            <circle cx="22" cy="-17" r="2" />
          </g>
        </g>
        <g className="worm" transform="translate(258 320)">
          <path
            d="M0 0c13-13 26 14 39-1S63-4 70-13"
            fill="none"
            stroke="#89583e"
            strokeWidth="16"
            strokeLinecap="round"
          />
          <path
            d="M0-2c13-13 26 14 39-1s24-3 31-12"
            fill="none"
            stroke="#ce9678"
            strokeWidth="13"
            strokeLinecap="round"
          />
          <path d="m10-4-2 8m16-5-2 8m17-8 3 7m9-18 6 7" stroke="#b57e62" strokeWidth="2" />
          <ellipse cx="72" cy="-16" rx="11" ry="12" fill="#ce9678" />
          <circle cx="70" cy="-20" r="2" fill="#3f3c2d" />
          <circle cx="78" cy="-19" r="2" fill="#3f3c2d" />
          <path d="M71-13q3 4 6 0" stroke="#734c3b" fill="none" strokeWidth="1.6" />
        </g>
        <g fill="#6d844d">
          <path d="m99 315 2-13 4 13 5-9-1 14M467 307l3-15 4 13 6-6-2 13M169 337l3-11 4 10 5-5-1 10" />
        </g>
        {count > 0 && (
          <g transform="translate(490 251)">
            <path d="M0 48V13" stroke="#657d45" strokeWidth="3" />
            <path
              d="M0 35c-16 0-19-10-16-17 11-2 19 5 16 17M0 25c0-12 10-17 18-15 2 11-7 17-18 15"
              fill="#90a464"
            />
            <g fill="#d3a269">
              <ellipse cy="5" rx="6" ry="13" />
              <ellipse cy="5" rx="6" ry="13" transform="rotate(60 0 5)" />
              <ellipse cy="5" rx="6" ry="13" transform="rotate(120 0 5)" />
            </g>
            <circle cy="5" r="5" fill="#8b724c" />
          </g>
        )}
        {count > 2 && (
          <g transform="translate(75 265)">
            <path
              d="M0 45V0M0 30c-14 0-18-10-15-15C-3 14 3 22 0 30M0 20C0 7 9 2 17 4c0 12-8 16-17 16"
              stroke="#74894f"
              fill="#93a56d"
              strokeWidth="2"
            />
            <circle r="10" fill="#bb8974" />
            <circle r="4" fill="#e8c68f" />
          </g>
        )}
        <g className="butterfly" transform="translate(147 164) rotate(-18)">
          <path d="M0 0C-22-21-26 5 0 7 20-20 28 0 0 7" fill="#d7ae6a" />
          <path d="M0 1v10" stroke="#857349" strokeWidth="2" />
        </g>
        <g fill="#a3ad82">
          <circle cx="179" cy="105" r="2" />
          <circle cx="421" cy="181" r="2.5" />
          <circle cx="366" cy="89" r="2" />
        </g>
      </svg>
      <span className="scene-caption">a little messy. a little magical.</span>
    </div>
  );
}
