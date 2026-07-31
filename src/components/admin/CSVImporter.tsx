"use client";
import React, { useState, useEffect } from "react";
import Button from "../ui/Button";
import { Upload, HelpCircle, Check, AlertCircle, RefreshCw, HelpCircle as HelpIcon } from "lucide-react";
import { toast } from "sonner";
import { bulkImportPlayers } from "@/app/admin/players/actions";
import Input from "../ui/Input";
import { POSITION_PRESETS, STANDARD_POSITIONS } from "@/lib/utils/positionPresets";

interface CSVImporterProps {
  clubs: { id: number; name: string }[];
  seasonAgeGroups: {
    id: number;
    gender: string;
    season_id: number;
    seasons: { name: string };
    age_groups: { name: string };
  }[];
  onImportSuccess: () => void;
  defaultClubId?: number;
  seasons?: { id: number; name: string }[];
  activeSeasonId?: number;
  events?: { id: number; name: string; season_id: number }[];
}

// Obvious preset mapping rules for Gender
function guessGender(raw: string): "male" | "female" | null {
  const clean = raw.trim().toLowerCase();
  if (["male", "m", "boy", "b", "boys"].includes(clean)) return "male";
  if (["female", "f", "girl", "g", "girls"].includes(clean)) return "female";
  return null;
}

// Build a normalized lookup cache of POSITION_PRESETS at module load time
const normalizedPresetsCache: Record<string, string> = {};
if (typeof window !== "undefined" || true) {
  Object.entries(POSITION_PRESETS || {}).forEach(([key, val]) => {
    const cleanKey = key.trim().toLowerCase().replace(/[^a-z0-9\s]/g, "");
    normalizedPresetsCache[cleanKey] = val;
  });
}

function guessPosition(raw: string): string | null {
  const clean = raw.trim().toLowerCase().replace(/[^a-z0-9\s]/g, "");
  return normalizedPresetsCache[clean] || null;
}

// Simple but robust CSV/TSV parser that handles quotes and delimiters
function parseCSV(text: string): string[][] {
  const lines: string[][] = [];
  let row: string[] = [];
  let inQuotes = false;
  let currentVal = "";

  const cleanText = text.trim().replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  for (let i = 0; i < cleanText.length; i++) {
    const char = cleanText[i];
    const nextChar = cleanText[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentVal += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      row.push(currentVal.trim());
      currentVal = "";
    } else if (char === "\t" && !inQuotes) {
      row.push(currentVal.trim());
      currentVal = "";
    } else if (char === "\n" && !inQuotes) {
      row.push(currentVal.trim());
      lines.push(row);
      row = [];
      currentVal = "";
    } else {
      currentVal += char;
    }
  }

  if (currentVal || row.length > 0) {
    row.push(currentVal.trim());
    lines.push(row);
  }

  return lines.filter(r => r.length > 0 && r.some(cell => cell !== ""));
}

export default function CSVImporter({
  clubs,
  seasonAgeGroups,
  onImportSuccess,
  defaultClubId,
  seasons = [],
  activeSeasonId,
  events = [],
}: CSVImporterProps) {
  const [csvText, setCsvText] = useState("");
  const [parsedData, setParsedData] = useState<string[][]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [isParsed, setIsParsed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Import mode: "season" or "event"
  const [importMode, setImportMode] = useState<"season" | "event">("season");

  // Mappings between database fields and CSV column indexes
  const [mappings, setMappings] = useState<Record<string, number>>({
    first_name: -1,
    last_name: -1,
    date_of_birth: -1,
    gender: -1,
    tryout_number: -1,
    position: -1,
    rating: -1,
  });

  const [autoGuessedFields, setAutoGuessedFields] = useState<Set<string>>(new Set());

  // Global settings for the import
  const [selectedSeasonId, setSelectedSeasonId] = useState<string>(
    activeSeasonId ? activeSeasonId.toString() : ""
  );
  const [selectedClubId, setSelectedClubId] = useState<string>(
    defaultClubId ? defaultClubId.toString() : ""
  );
  const [selectedAgeGroupId, setSelectedAgeGroupId] = useState<string>("");
  const [selectedEventId, setSelectedEventId] = useState<string>("");

  // Interactive value mapping states
  const [wizardData, setWizardData] = useState<{
    rawGenders: string[];
    rawPositions: string[];
  } | null>(null);

  // Completed user mappings
  const [genderMappings, setGenderMappings] = useState<Record<string, "male" | "female">>({});
  const [positionMappings, setPositionMappings] = useState<Record<string, string>>({});

  useEffect(() => {
    if (activeSeasonId) {
      setSelectedSeasonId(activeSeasonId.toString());
    }
  }, [activeSeasonId]);

  const filteredSeasonAgeGroups = seasonAgeGroups.filter((g) => {
    if (!selectedSeasonId) return true;
    return g.season_id === Number(selectedSeasonId);
  });

  const filteredEvents = events.filter((e) => {
    if (!selectedSeasonId) return true;
    return e.season_id === Number(selectedSeasonId);
  });

  const handleParse = () => {
    if (!csvText.trim()) {
      toast.error("Please paste CSV/TSV data first.");
      return;
    }

    try {
      const rows = parseCSV(csvText);
      if (rows.length < 2) {
        toast.error("CSV must contain a header row and at least one data row.");
        return;
      }

      const csvHeaders = rows[0];
      const csvData = rows.slice(1);

      setHeaders(csvHeaders);
      setParsedData(csvData);

      // Attempt smart auto-mapping of headers
      const newMappings: Record<string, number> = {
        first_name: -1,
        last_name: -1,
        date_of_birth: -1,
        gender: -1,
        tryout_number: -1,
        position: -1,
        rating: -1,
      };

      const guessed = new Set<string>();

      csvHeaders.forEach((header, index) => {
        const h = header.toLowerCase().replace(/[^a-z0-9]/g, "");
        if (h.includes("first") || h === "fname" || h === "name") {
          newMappings.first_name = index;
          guessed.add("first_name");
        } else if (h.includes("last") || h === "lname") {
          newMappings.last_name = index;
          guessed.add("last_name");
        } else if (h.includes("birth") || h.includes("dob") || h === "date") {
          newMappings.date_of_birth = index;
          guessed.add("date_of_birth");
        } else if (h.includes("gender") || h === "sex") {
          newMappings.gender = index;
          guessed.add("gender");
        } else if (h.includes("tryout") || h.includes("num")) {
          newMappings.tryout_number = index;
          guessed.add("tryout_number");
        } else if (h.includes("pos")) {
          newMappings.position = index;
          guessed.add("position");
        } else if (h.includes("rate") || h.includes("score")) {
          newMappings.rating = index;
          guessed.add("rating");
        }
      });

      setMappings(newMappings);
      setAutoGuessedFields(guessed);
      setIsParsed(true);
      setWizardData(null);
      setGenderMappings({});
      setPositionMappings({});
      toast.success("CSV parsed successfully! Map your columns below.");
    } catch (e: any) {
      toast.error("Failed to parse CSV text: " + e.message);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setCsvText(text);
      toast.success(`Loaded file: ${file.name}`);
    };
    reader.readAsText(file);
  };

  const handleMappingChange = (dbField: string, index: number) => {
    setMappings((prev) => ({
      ...prev,
      [dbField]: index,
    }));
    setAutoGuessedFields((prev) => {
      const next = new Set(prev);
      next.delete(dbField);
      return next;
    });
  };

  // Inspect unmatched values and trigger Verification Wizard if needed
  const handleImportAttempt = () => {
    if (!selectedSeasonId) {
      toast.error("Please select a target Season for the imported players.");
      return;
    }

    if (!selectedClubId) {
      toast.error("Please select a target Club for the imported players.");
      return;
    }

    if (importMode === "event" && !selectedEventId) {
      toast.error("Please select a target Event for event registration.");
      return;
    }

    if (mappings.first_name === -1 || mappings.last_name === -1) {
      toast.error("You must map both First Name and Last Name columns.");
      return;
    }

    // Inspect parsed rows for unique raw genders and positions
    const uniqueRawGenders = new Set<string>();
    const uniqueRawPositions = new Set<string>();

    parsedData.forEach((row) => {
      if (mappings.gender !== -1) {
        const val = row[mappings.gender]?.trim();
        if (val) uniqueRawGenders.add(val);
      }
      if (mappings.position !== -1) {
        const val = row[mappings.position]?.trim();
        if (val) uniqueRawPositions.add(val);
      }
    });

    const unmappedGendersList: string[] = [];
    const initialGenderMappings = { ...genderMappings };

    uniqueRawGenders.forEach((raw) => {
      if (initialGenderMappings[raw]) return;
      const guess = guessGender(raw);
      if (guess) {
        initialGenderMappings[raw] = guess;
      } else {
        unmappedGendersList.push(raw);
      }
    });

    const unmappedPositionsList: string[] = [];
    const initialPositionMappings = { ...positionMappings };

    uniqueRawPositions.forEach((raw) => {
      if (initialPositionMappings[raw]) return;
      const guess = guessPosition(raw);
      if (guess) {
        initialPositionMappings[raw] = guess;
      } else {
        unmappedPositionsList.push(raw);
      }
    });

    // Update preset mappings
    setGenderMappings(initialGenderMappings);
    setPositionMappings(initialPositionMappings);

    // If there are unmapped values, present the Wizard Screen
    if (unmappedGendersList.length > 0 || unmappedPositionsList.length > 0) {
      setWizardData({
        rawGenders: unmappedGendersList,
        rawPositions: unmappedPositionsList,
      });
      toast.info("Some values need manual verification mapping before import.");
    } else {
      // Direct Import (no unmatched fields)
      executeImport(initialGenderMappings, initialPositionMappings);
    }
  };

function normalizePositionValue(val: string): string {
  if (!val) return "";
  
  const clean = val.trim().toLowerCase().replace(/[^a-z0-9\s]/g, "");
  if (normalizedPresetsCache[clean]) return normalizedPresetsCache[clean];
  
  // Extract leading digit fallback, e.g. "#7 Right Winger" -> "7"
  const match = val.match(/^\s*#?(\d+)/);
  if (match) return match[1];

  return val.trim();
}

  const executeImport = async (
    gMappings: Record<string, "male" | "female">,
    pMappings: Record<string, string>
  ) => {
    setIsLoading(true);
    try {
      const playersList = parsedData.map((row) => {
        const first_name = mappings.first_name !== -1 ? row[mappings.first_name] : "";
        const last_name = mappings.last_name !== -1 ? row[mappings.last_name] : "";
        const rawDob = mappings.date_of_birth !== -1 ? row[mappings.date_of_birth] : "";
        
        // Resolve gender mapping
        const rawGender = mappings.gender !== -1 ? row[mappings.gender]?.trim() : "";
        const gender = gMappings[rawGender] || "male"; // default fallback

        const tryout_number = mappings.tryout_number !== -1 ? row[mappings.tryout_number] : "";
        
        // Resolve position mapping
        const rawPos = mappings.position !== -1 ? row[mappings.position]?.trim() : "";
        const mappedPos = pMappings[rawPos] || rawPos || "";
        const position = normalizePositionValue(mappedPos);

        const rating = mappings.rating !== -1 ? Number(row[mappings.rating]) || 0 : 0;

        let date_of_birth = "";
        if (rawDob) {
          const d = new Date(rawDob);
          if (!isNaN(d.getTime())) {
            date_of_birth = d.toISOString().split("T")[0];
          }
        }

        return {
          first_name,
          last_name,
          date_of_birth,
          gender,
          club_id: Number(selectedClubId),
          season_age_group_id: selectedAgeGroupId ? Number(selectedAgeGroupId) : undefined,
          tryout_number,
          position,
          rating,
        };
      }).filter(p => p.first_name && p.last_name);

      if (playersList.length === 0) {
        toast.error("No valid players parsed. Check mapping columns.");
        setIsLoading(false);
        return;
      }

      const targetEventId = importMode === "event" && selectedEventId ? Number(selectedEventId) : undefined;
      const res = await bulkImportPlayers(playersList, Number(selectedSeasonId), targetEventId);

      if (res.success) {
        const modeLabel = importMode === "event" ? "registered for event" : "imported to season";
        toast.success(`Success! ${res.count} players ${modeLabel}.`);
        setCsvText("");
        setIsParsed(false);
        setWizardData(null);
        setParsedData([]);
        onImportSuccess();
      } else {
        toast.error(res.error || "Failed to import players.");
      }
    } catch (e: any) {
      toast.error("Import error: " + e.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className='p-6 bg-surface border border-border rounded-2xl shadow-sm'>
      <div className='flex items-center justify-between mb-4 border-b border-border pb-3'>
        <div>
          <h2 className='text-lg font-bold text-text flex items-center gap-2'>
            <Upload size={20} className='text-primary' />
            Bulk CSV / Excel Importer
          </h2>
          <p className='text-xs text-muted mt-0.5'>
            Paste data directly from Excel/Google Sheets, or drag in a CSV file.
          </p>
        </div>
      </div>

      {/* Settings / Mode Panel (Always Visible) */}
      <div className='mb-6 space-y-4 bg-background/60 p-4 rounded-xl border border-border'>
        {/* Import Mode Toggle */}
        <div className='flex flex-wrap items-center gap-2 pb-3 border-b border-border/50'>
          <span className='text-xs font-bold text-text-label mr-2'>Import Mode:</span>
          <button
            type='button'
            onClick={() => setImportMode("season")}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
              importMode === "season"
                ? "bg-primary text-white border-primary shadow-xs"
                : "bg-surface border-border text-muted hover:text-text"
            }`}
          >
            Register for Season
          </button>
          <button
            type='button'
            onClick={() => setImportMode("event")}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
              importMode === "event"
                ? "bg-primary text-white border-primary shadow-xs"
                : "bg-surface border-border text-muted hover:text-text"
            }`}
          >
            Register for Event
          </button>
          {importMode === "event" && (
            <span className='text-[0.6rem] text-muted md:ml-2'>
              Players will be registered to season + set as available for the event & all sessions
            </span>
          )}
        </div>

        {/* Configurations */}
        <div className={`grid grid-cols-1 gap-4 ${importMode === "event" ? "md:grid-cols-4" : "md:grid-cols-3"}`}>
          <div>
            <label className='block text-xs font-bold text-text-label mb-1'>Target Season *</label>
            <select
              value={selectedSeasonId}
              onChange={(e) => {
                setSelectedSeasonId(e.target.value);
                setSelectedAgeGroupId(""); 
                setSelectedEventId(""); 
              }}
              className='text-xs bg-surface font-semibold py-2.5 px-3 border border-border rounded-lg w-full focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer'
            >
              <option value=''>-- Select Target Season --</option>
              {seasons.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className='block text-xs font-bold text-text-label mb-1'>Target Club *</label>
            <select
              value={selectedClubId}
              onChange={(e) => setSelectedClubId(e.target.value)}
              className='text-xs bg-surface font-semibold py-2.5 px-3 border border-border rounded-lg w-full focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer'
            >
              <option value=''>-- Select Target Club --</option>
              {clubs.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className='block text-xs font-bold text-text-label mb-1'>
              Initial Age Group / Division (Optional)
            </label>
            <select
              value={selectedAgeGroupId}
              onChange={(e) => setSelectedAgeGroupId(e.target.value)}
              className='text-xs bg-surface font-semibold py-2.5 px-3 border border-border rounded-lg w-full focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer'
            >
              <option value=''>-- Do Not Assign Yet (Auto-assign by DOB) --</option>
              {filteredSeasonAgeGroups.map((g) => (
                <option key={g.id} value={g.id}>
                  [{g.seasons.name}] {g.age_groups.name} ({g.gender})
                </option>
              ))}
            </select>
          </div>

          {/* Event selector (only visible in event mode) */}
          {importMode === "event" && (
            <div>
              <label className='block text-xs font-bold text-text-label mb-1'>Target Event *</label>
              <select
                value={selectedEventId}
                onChange={(e) => setSelectedEventId(e.target.value)}
                className={`text-xs bg-surface font-semibold py-2.5 px-3 border rounded-lg w-full focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer ${
                  !selectedEventId ? "border-pink-400 bg-pink-50/30" : "border-border"
                }`}
              >
                <option value=''>-- Select Event --</option>
                {filteredEvents.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
              {!selectedEventId && (
                <span className='text-[0.55rem] font-bold text-pink-500 mt-0.5 block'>⚠️ Required for event mode</span>
              )}
            </div>
          )}
        </div>
      </div>

      {wizardData ? (
        /* WIZARD VALUE VERIFICATION STEP */
        <div className='space-y-6 bg-yellow-500/5 border border-yellow-500/20 p-5 rounded-2xl animate-fadeIn'>
          <div>
            <h3 className='text-sm font-bold text-yellow-600 flex items-center gap-2'>
              <AlertCircle size={18} />
              Verify Value Mappings
            </h3>
            <p className='text-xs text-muted mt-1 leading-relaxed'>
              We found some unrecognized gender or position values. Please choose the correct database values for them.
              Unmapped entries will fall back to safe defaults.
            </p>
          </div>

          <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
            {/* Gender mappings column */}
            {wizardData.rawGenders.length > 0 && (
              <div className='space-y-3'>
                <h4 className='text-xs font-bold text-text-label uppercase border-b border-border pb-1'>
                  Gender Column Mappings
                </h4>
                <div className='space-y-2 max-h-60 overflow-y-auto pr-1 custom-scrollbar'>
                  {wizardData.rawGenders.map((raw) => (
                    <div key={raw} className='flex items-center justify-between gap-3 bg-surface p-2 rounded-lg border border-border'>
                      <span className='text-xs font-bold text-text truncate max-w-[150px]' title={raw}>
                        &quot;{raw}&quot;
                      </span>
                      <ChevronSelect
                        value={genderMappings[raw] || "male"}
                        onChange={(val) => setGenderMappings(prev => ({ ...prev, [raw]: val as "male" | "female" }))}
                        options={[
                          { value: "male", label: "Male" },
                          { value: "female", label: "Female" },
                        ]}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Position mappings column */}
            {wizardData.rawPositions.length > 0 && (
              <div className='space-y-3'>
                <h4 className='text-xs font-bold text-text-label uppercase border-b border-border pb-1'>
                  Position Column Mappings
                </h4>
                <div className='space-y-2 max-h-60 overflow-y-auto pr-1 custom-scrollbar'>
                  {wizardData.rawPositions.map((raw) => (
                    <div key={raw} className='flex flex-col gap-1.5 bg-surface p-2.5 rounded-lg border border-border'>
                      <span className='text-xs font-bold text-text truncate block' title={raw}>
                        Raw value: &quot;{raw}&quot;
                      </span>
                      <div className='flex gap-2 items-center'>
                        <ChevronSelect
                          value={positionMappings[raw] || STANDARD_POSITIONS[0]}
                          onChange={(val) => setPositionMappings(prev => ({ ...prev, [raw]: val }))}
                          options={STANDARD_POSITIONS.map(p => ({ value: p, label: p }))}
                        />
                        <Input
                          placeholder='Custom value...'
                          value={positionMappings[raw] || ""}
                          onChange={(e) => {
                            const val = e.target.value;
                            setPositionMappings(prev => ({ ...prev, [raw]: val }));
                          }}
                          className='text-xs !mb-0 font-medium py-1 px-2 h-[32px] flex-1'
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className='flex justify-between items-center border-t border-border pt-4 mt-4'>
            <Button variant='outline' onClick={() => setWizardData(null)}>
              Modify Mappings
            </Button>
            <Button
              variant='success'
              onClick={() => executeImport(genderMappings, positionMappings)}
              disabled={isLoading}
              className='px-6 flex items-center gap-1.5'
            >
              {isLoading ? (
                <>
                  <RefreshCw className='animate-spin' size={14} />
                  <span>Importing...</span>
                </>
              ) : (
                <span>Confirm Mappings & Import Players</span>
              )}
            </Button>
          </div>
        </div>
      ) : !isParsed ? (
        <div className='space-y-4'>
          <div>
            <label className='font-medium text-sm text-text-label flex justify-between items-center mb-1'>
              <span>Paste Row Data (Comma or Tab separated)</span>
              <span className='text-xs font-normal text-muted flex items-center gap-1'>
                <HelpCircle size={14} /> Include header row!
              </span>
            </label>
            <textarea
              className='font-mono text-xs w-full h-44 p-3 border border-border rounded-xl bg-background/50 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all resize-y'
              placeholder={"first_name,last_name,dob,gender,tryout_num,position,rating\nJohn,Doe,2014-05-12,Boy,102,Midfielder,8\nJane,Smith,2015-08-22,Girl,204,Forward,7"}
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
            />
          </div>

          <div className='flex items-center gap-4'>
            <div className='flex-1'>
              <label className='text-xs font-medium text-muted block mb-1'>Or upload a file:</label>
              <input
                type='file'
                accept='.csv,.tsv,.txt'
                onChange={handleFileUpload}
                className='text-xs border border-border border-dashed rounded-lg p-2 w-full bg-background cursor-pointer hover:bg-background/80 transition-all'
              />
            </div>
            <div className='self-end'>
              <Button onClick={handleParse} className='h-10 px-5'>
                Analyze and Map Columns
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className='space-y-6 animate-fadeIn'>
          {/* Mapping Controls */}
          <div>
            <h3 className='text-sm font-bold text-text mb-2 flex items-center gap-1.5'>
              <Check size={16} className='text-success' />
              Map Database Fields to CSV Columns
            </h3>
            <div className='flex items-center gap-4 mb-3 text-[0.6rem] font-bold text-muted'>
              <span className='flex items-center gap-1'>
                <span className='w-3 h-3 rounded bg-pink-100 border border-pink-300 inline-block'></span>
                Required — must be mapped
              </span>
              <span className='flex items-center gap-1'>
                <span className='w-3 h-3 rounded bg-orange-100 border border-orange-300 inline-block'></span>
                Auto-matched — verify this is correct
              </span>
            </div>
            <div className='grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3'>
              {[
                { key: "first_name", label: "First Name *", required: true },
                { key: "last_name", label: "Last Name *", required: true },
                { key: "date_of_birth", label: "Birth Date (DOB)", required: false },
                { key: "gender", label: "Gender", required: false },
                { key: "tryout_number", label: "Tryout Number", required: false },
                { key: "position", label: "Position", required: false },
                { key: "rating", label: "Initial Rating (0-10)", required: false },
              ].map((field) => {
                const isUnmappedRequired = field.required && mappings[field.key] === -1;
                const isAutoGuessed = autoGuessedFields.has(field.key) && mappings[field.key] !== -1;

                let containerClass = "border-border bg-background/30";
                let selectBorderClass = "border-border";
                let badgeContent = null;

                if (isUnmappedRequired) {
                  containerClass = "border-pink-400/60 bg-pink-50/40 shadow-sm ring-1 ring-pink-400/20";
                  selectBorderClass = "border-pink-400/40 focus:ring-pink-500";
                  badgeContent = (
                    <span className='text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-pink-100 text-pink-600 border border-pink-300 uppercase tracking-wider animate-pulse'>
                      ⚠️ Required
                    </span>
                  );
                } else if (isAutoGuessed) {
                  containerClass = "border-orange-400/60 bg-orange-50/40 shadow-sm ring-1 ring-orange-400/15";
                  selectBorderClass = "border-orange-400/40 focus:ring-orange-500";
                  badgeContent = (
                    <span className='text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-orange-100 text-orange-600 border border-orange-300 uppercase tracking-wider'>
                      🔶 Auto-matched
                    </span>
                  );
                }

                return (
                  <div
                    key={field.key}
                    className={`border p-3 rounded-xl flex flex-col justify-between transition-all duration-200 ${containerClass}`}
                  >
                    <div className='flex items-center justify-between gap-1'>
                      <span className={`text-xs font-bold ${field.required ? "text-primary" : "text-text-label"}`}>
                        {field.label}
                      </span>
                      {badgeContent}
                    </div>
                    <select
                      value={mappings[field.key]}
                      onChange={(e) => handleMappingChange(field.key, Number(e.target.value))}
                      className={`text-xs mt-1.5 py-1.5 px-2 bg-surface border rounded w-full outline-none focus:ring-1 focus:ring-primary cursor-pointer ${selectBorderClass}`}
                    >
                      <option value='-1'>-- Ignore / Set Default --</option>
                      {headers.map((h, idx) => (
                        <option key={idx} value={idx}>
                          Col {idx + 1}: &quot;{h}&quot;
                        </option>
                      ))}
                    </select>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Data Preview */}
          <div>
            <h3 className='text-xs font-bold text-muted uppercase tracking-wider mb-2 flex items-center gap-1'>
              <AlertCircle size={14} /> Sample Data Preview (First 3 rows mapped)
            </h3>
            <div className='overflow-x-auto border border-border rounded-xl'>
              <table className='w-full text-left text-xs'>
                <thead className='bg-background text-text-label font-bold border-b border-border'>
                  <tr>
                    <th className='p-2.5'>First Name</th>
                    <th className='p-2.5'>Last Name</th>
                    <th className='p-2.5'>Birthdate</th>
                    <th className='p-2.5'>Gender</th>
                    <th className='p-2.5'>Tryout #</th>
                    <th className='p-2.5'>Position</th>
                    <th className='p-2.5'>Rating</th>
                  </tr>
                </thead>
                <tbody className='divide-y divide-border bg-surface'>
                  {parsedData.slice(0, 3).map((row, rIdx) => {
                    const fn = mappings.first_name !== -1 ? row[mappings.first_name] : "-";
                    const ln = mappings.last_name !== -1 ? row[mappings.last_name] : "-";
                    const dob = mappings.date_of_birth !== -1 ? row[mappings.date_of_birth] : "-";
                    const gen = mappings.gender !== -1 ? row[mappings.gender] : "-";
                    const tNum = mappings.tryout_number !== -1 ? row[mappings.tryout_number] : "-";
                    const pos = mappings.position !== -1 ? row[mappings.position] : "-";
                    const rat = mappings.rating !== -1 ? row[mappings.rating] : "-";

                    return (
                      <tr key={rIdx} className='hover:bg-background/20'>
                        <td className='p-2.5 font-medium'>{fn}</td>
                        <td className='p-2.5 font-medium'>{ln}</td>
                        <td className='p-2.5'>{dob}</td>
                        <td className='p-2.5'>{gen}</td>
                        <td className='p-2.5'>{tNum}</td>
                        <td className='p-2.5'>{pos}</td>
                        <td className='p-2.5'>{rat}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Controls */}
          <div className='flex justify-between items-center border-t border-border pt-4'>
            <Button variant='outline' onClick={() => setIsParsed(false)} disabled={isLoading}>
              Clear & Go Back
            </Button>
            <div className='flex items-center gap-3'>
              <span className='text-xs text-muted'>
                Ready to {importMode === "event" ? "register" : "import"} {parsedData.length} records
              </span>
              <Button onClick={handleImportAttempt} disabled={isLoading} variant='success' className='px-6'>
                {isLoading
                  ? "Importing..."
                  : importMode === "event"
                    ? `Register ${parsedData.length} Players for Event`
                    : `Import ${parsedData.length} Players`}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ChevronSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (val: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className='text-xs bg-background font-semibold py-1.5 px-2 border border-border rounded-lg outline-none cursor-pointer focus:ring-1 focus:ring-primary'
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
