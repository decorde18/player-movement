// Predefined list of standard soccer positions mapped to US Soccer number tags.
// Stored format: "Number - Position Name" (e.g. "1 - Goalkeeper", "2 - Right Fullback")
export const STANDARD_POSITIONS = [
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "11",
];

// Mapping rules to guess position from raw inputs
// You can edit or add new rules/aliases here
export const POSITION_PRESETS: Record<string, string> = {
  // Goalkeepers
  "1 - Goalkeeper": "1",
  "Goal Keeper":"1",
  "1": "1",
  gk: "1",
  goalkeeper: "1",
  goalie: "1",
  
  // Right Back
  "2 - Right Fullback": "2",
  "#2 Right Back":"2",
  "2": "2",
  rb: "2",
  "right back": "2",
  "right fullback": "2",
  
  
  
  // Left Back
  "3 - Left Fullback": "3",
  "#3 Left Back":"3",
  "3": "3",
  lb: "3",
  "left back": "3",
  "left fullback": "3",
  
  // Center Backs
  "4 - Center Back (Defending Midfielder)": "4",
  "4": "4",
  "#4 Right Center Back":"4",

  "5 - Center Back": "5",
  "5": "5",
  cb: "5",
  "center back": "5",
  defender: "5",
  def: "5",
  
  // Defensive Mid
"6 - Defensive Midfielder": "6",
"#6 Def CMF":"6",
  "6": "6",
  dm: "6",
  dmf: "6",
  "defensive midfielder": "6",
  
  // Right Winger
  "7 - Right Winger": "7",
      "#7 Right Winger":"7",
  "7": "7",
  rw: "7",
  rf: "7",
  "right wing": "7",
  "right forward": "7",
  "right winger": "7",

  // Central Mid
  "8 - Central Midfielder (Box-to-Box)": "8",
  "#8 CMF":"8",
  "8": "8",
  cm: "8",
  mid: "8",
  midfielder: "8",
  "central midfielder": "8",
  
  // Striker
  "9 - Striker": "9",
  "#9 Center FWD":"9",
  "9": "9",
  st: "9",
  fwd: "9",
  striker: "9",
  forward: "9",
  
  // Attacking Mid
  "10 - Attacking Midfielder": "10",
      "#10 Attacking CMF":"10",
      "10": "10",
      am: "10",
      cam: "10",
      "attacking midfielder": "10",
      
      // Left Winger
      "11 - Left Winger": "11",
      "#11 Left Winger":"11",
  "11": "11",
  lw: "11",
  lf: "11",
  "left wing": "11",
  "left forward": "11",
  "left winger": "11",
};



