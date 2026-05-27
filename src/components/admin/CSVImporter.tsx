"use client";

import React, { useState } from "react";
import Button from "../ui/Button";
import { Upload, HelpCircle, Check, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { bulkImportPlayers } from "@/app/admin/players/actions";

interface CSVImporterProps {
  clubs: { id: number; name: string }[];
  seasonAgeGroups: {
    id: number;
    gender: string;
    seasons: { name: string };
    age_groups: { name: string };
  }[];
  onImportSuccess: () => void;
  defaultClubId?: number;
}

// Simple but robust CSV/TSV parser that handles quotes and delimiters
function parseCSV(text: string): string[][] {
  const lines: string[][] = [];
  let row: string[] = [];
  let inQuotes = false;
  let currentVal = "";

  // Normalize newlines
  const cleanText = text.trim().replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  for (let i = 0; i < cleanText.length; i++) {
    const char = cleanText[i];
    const nextChar = cleanText[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote
        currentVal += '"';
        i++;
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      // Cell boundary
      row.push(currentVal.trim());
      currentVal = "";
    } else if (char === "\t" && !inQuotes) {
      // Support TSV (from Excel copy-paste)
      row.push(currentVal.trim());
      currentVal = "";
    } else if (char === "\n" && !inQuotes) {
      // Row boundary
      row.push(currentVal.trim());
      lines.push(row);
      row = [];
      currentVal = "";
    } else {
      currentVal += char;
    }
  }

  // Handle final value and row
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
}: CSVImporterProps) {
  const [csvText, setCsvText] = useState("");
  const [parsedData, setParsedData] = useState<string[][]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [isParsed, setIsParsed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

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

  // Global settings for the import
  const [selectedClubId, setSelectedClubId] = useState<string>(
    defaultClubId ? defaultClubId.toString() : ""
  );
  const [selectedAgeGroupId, setSelectedAgeGroupId] = useState<string>("");

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

      csvHeaders.forEach((header, index) => {
        const h = header.toLowerCase().replace(/[^a-z0-9]/g, "");
        if (h.includes("first") || h === "fname" || h === "name") {
          newMappings.first_name = index;
        } else if (h.includes("last") || h === "lname") {
          newMappings.last_name = index;
        } else if (h.includes("birth") || h.includes("dob") || h === "date") {
          newMappings.date_of_birth = index;
        } else if (h.includes("gender") || h === "sex") {
          newMappings.gender = index;
        } else if (h.includes("tryout") || h.includes("num")) {
          newMappings.tryout_number = index;
        } else if (h.includes("pos")) {
          newMappings.position = index;
        } else if (h.includes("rate") || h.includes("score")) {
          newMappings.rating = index;
        }
      });

      setMappings(newMappings);
      setIsParsed(true);
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
  };

  const handleImport = async () => {
    if (!selectedClubId) {
      toast.error("Please select a target Club for the imported players.");
      return;
    }

    // Validation: First Name and Last Name must be mapped
    if (mappings.first_name === -1 || mappings.last_name === -1) {
      toast.error("You must map both First Name and Last Name columns.");
      return;
    }

    setIsLoading(true);
    try {
      // Process data rows according to mappings
      const playersList = parsedData.map((row) => {
        const first_name = mappings.first_name !== -1 ? row[mappings.first_name] : "";
        const last_name = mappings.last_name !== -1 ? row[mappings.last_name] : "";
        const rawDob = mappings.date_of_birth !== -1 ? row[mappings.date_of_birth] : "";
        const gender = mappings.gender !== -1 ? row[mappings.gender] : "Coed";
        const tryout_number = mappings.tryout_number !== -1 ? row[mappings.tryout_number] : "";
        const position = mappings.position !== -1 ? row[mappings.position] : "";
        const rating = mappings.rating !== -1 ? Number(row[mappings.rating]) || 0 : 0;

        // Try mapping date format
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
      }).filter(p => p.first_name && p.last_name); // Clean blank rows

      if (playersList.length === 0) {
        toast.error("No valid players parsed from mapping. Please check row data.");
        setIsLoading(false);
        return;
      }

      const res = await bulkImportPlayers(playersList);
      if (res.success) {
        toast.success(`Success! Imported ${res.count} players.`);
        setCsvText("");
        setIsParsed(false);
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

      {!isParsed ? (
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
              placeholder="first_name,last_name,dob,gender,tryout_num,position,rating&#10;John,Doe,2014-05-12,Boy,102,Midfielder,8&#10;Jane,Smith,2015-08-22,Girl,204,Forward,7"
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
          {/* Settings Section */}
          <div className='grid grid-cols-1 md:grid-cols-2 gap-4 bg-background/60 p-4 rounded-xl border border-border'>
            <div>
              <label className='block text-xs font-bold text-text-label mb-1'>Target Club *</label>
              <select
                value={selectedClubId}
                onChange={(e) => setSelectedClubId(e.target.value)}
                className='text-sm bg-surface font-semibold py-2 px-3 border border-border rounded-md w-full focus:outline-none focus:ring-1 focus:ring-primary'
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
                className='text-sm bg-surface font-semibold py-2 px-3 border border-border rounded-md w-full focus:outline-none focus:ring-1 focus:ring-primary'
              >
                <option value=''>-- Do Not Assign Yet --</option>
                {seasonAgeGroups.map((g) => (
                  <option key={g.id} value={g.id}>
                    [{g.seasons.name}] {g.age_groups.name} ({g.gender})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Mapping Controls */}
          <div>
            <h3 className='text-sm font-bold text-text mb-2 flex items-center gap-1.5'>
              <Check size={16} className='text-success' />
              Map Database Fields to CSV Columns
            </h3>
            <div className='grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3'>
              {/* Field mapping selectors */}
              {[
                { key: "first_name", label: "First Name *", required: true },
                { key: "last_name", label: "Last Name *", required: true },
                { key: "date_of_birth", label: "Birth Date (DOB)", required: false },
                { key: "gender", label: "Gender", required: false },
                { key: "tryout_number", label: "Tryout Number", required: false },
                { key: "position", label: "Position", required: false },
                { key: "rating", label: "Initial Rating (0-10)", required: false },
              ].map((field) => (
                <div key={field.key} className='border border-border p-3 rounded-xl bg-background/30 flex flex-col justify-between'>
                  <span className={`text-xs font-bold ${field.required ? "text-primary" : "text-text-label"}`}>
                    {field.label}
                  </span>
                  <select
                    value={mappings[field.key]}
                    onChange={(e) => handleMappingChange(field.key, Number(e.target.value))}
                    className='text-xs mt-1.5 py-1.5 px-2 bg-surface border border-border rounded w-full'
                  >
                    <option value='-1'>-- Ignore / Set Default --</option>
                    {headers.map((h, idx) => (
                      <option key={idx} value={idx}>
                        Col {idx + 1}: "{h}"
                      </option>
                    ))}
                  </select>
                </div>
              ))}
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
                Ready to import {parsedData.length} records
              </span>
              <Button onClick={handleImport} disabled={isLoading} variant='success' className='px-6'>
                {isLoading ? "Importing..." : `Import ${parsedData.length} Players`}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
