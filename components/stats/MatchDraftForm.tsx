"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import { getChampionIconUrl } from "@/utils/riotApi";

interface DdChampion {
  id: string;
  name: string;
}

interface ChampionMultiInputProps {
  label: string;
  value: string[];
  onChange: (next: string[]) => void;
  allChampions: DdChampion[];
  ddVersion: string;
  max?: number;
}

function ChampionMultiInput({
  label,
  value,
  onChange,
  allChampions,
  ddVersion,
  max = 5,
}: ChampionMultiInputProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const nameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of allChampions) map.set(c.id, c.name);
    return map;
  }, [allChampions]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const selectedSet = new Set(value);
    const pool = allChampions.filter((c) => !selectedSet.has(c.id));
    if (!q) return pool.slice(0, 12);
    return pool
      .filter(
        (c) =>
          c.name.toLowerCase().includes(q) || c.id.toLowerCase().includes(q)
      )
      .slice(0, 12);
  }, [allChampions, query, value]);

  function addChampion(champ: DdChampion) {
    if (value.length >= max || value.includes(champ.id)) return;
    onChange([...value, champ.id]);
    setQuery("");
    setOpen(false);
  }

  return (
    <div ref={wrapRef} className="relative">
      <div className="xp-inset px-1.5 py-1 min-h-[30px] flex flex-wrap items-center gap-1">
        {value.map((id) => (
          <span
            key={id}
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#232b27] border border-white/15 text-[11px] text-[#f0ede0]"
          >
            <img
              src={getChampionIconUrl(id, ddVersion)}
              alt={id}
              className="w-3.5 h-3.5 rounded-xs object-cover"
            />
            <span>{nameById.get(id) ?? id}</span>
            <button
              type="button"
              onClick={() => onChange(value.filter((x) => x !== id))}
              className="text-[#a6a89e] hover:text-[#ff857a] cursor-pointer"
              aria-label={`Remove ${id}`}
            >
              <X className="w-2.5 h-2.5" />
            </button>
          </span>
        ))}
        {value.length < max && (
          <input
            type="text"
            value={query}
            onFocus={() => setOpen(true)}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && filtered.length > 0) {
                e.preventDefault();
                addChampion(filtered[0]);
              } else if (
                e.key === "Backspace" &&
                !query &&
                value.length > 0
              ) {
                onChange(value.slice(0, -1));
              }
            }}
            placeholder={value.length === 0 ? label : "Add..."}
            className="flex-1 min-w-[70px] bg-transparent text-xs text-[#f0ede0] focus:outline-none placeholder:text-[#8e9286]"
          />
        )}
      </div>

      {open && filtered.length > 0 && value.length < max && (
        <div className="absolute left-0 right-0 top-full mt-1 z-40 max-h-48 overflow-y-auto rounded border border-[#c89b3c]/60 bg-[#141816] shadow-2xl divide-y divide-white/5">
          {filtered.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => addChampion(c)}
              className="w-full px-2 py-1.5 flex items-center gap-2 text-left text-xs text-[#f0ede0] hover:bg-[#2a2210] cursor-pointer"
            >
              <img
                src={getChampionIconUrl(c.id, ddVersion)}
                alt={c.name}
                className="w-4 h-4 rounded-xs object-cover shrink-0"
              />
              <span className="font-semibold">{c.name}</span>
              {c.id !== c.name && (
                <span className="text-[10px] text-[#8e9286] ml-auto">
                  {c.id}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

interface MatchDraftFormProps {
  seasonId: string | null;
  ddVersion: string;
  onSaved: () => void;
  onError: (msg: string) => void;
}

export function MatchDraftForm({
  seasonId,
  ddVersion,
  onSaved,
  onError,
}: MatchDraftFormProps) {
  const [allChampions, setAllChampions] = useState<DdChampion[]>([]);
  const [blueTeam, setBlueTeam] = useState("");
  const [redTeam, setRedTeam] = useState("");
  const [gameId, setGameId] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [blueBans, setBlueBans] = useState<string[]>([]);
  const [redBans, setRedBans] = useState<string[]>([]);
  const [bluePicks, setBluePicks] = useState<string[]>([]);
  const [redPicks, setRedPicks] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(
      `https://ddragon.leagueoflegends.com/cdn/${ddVersion}/data/en_US/champion.json`
    )
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (!json?.data || cancelled) return;
        const list = (
          Object.values(json.data) as { id: string; name: string }[]
        )
          .map((c) => ({ id: c.id, name: c.name }))
          .sort((a, b) => a.name.localeCompare(b.name));
        setAllChampions(list);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [ddVersion]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/admin/scdl-sheet-stats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gameId: gameId.trim(),
          seasonId,
          blueTeam: blueTeam.trim(),
          redTeam: redTeam.trim(),
          blueBans,
          redBans,
          bluePicks,
          redPicks,
          sourceUrl: sourceUrl.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        onError(json.error || "Failed to save draft");
      } else {
        setGameId("");
        setBlueTeam("");
        setRedTeam("");
        setSourceUrl("");
        setBlueBans([]);
        setRedBans([]);
        setBluePicks([]);
        setRedPicks([]);
        onSaved();
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <details className="xp-inset p-2.5 text-xs">
      <summary className="cursor-pointer font-bold text-[#f0c020] select-none">
        + Add / Update Match Draft (public.match_drafts)
      </summary>
      <form
        onSubmit={handleSubmit}
        className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2.5"
      >
        {/* Row 1: Blue Team (left), Red Team (middle), Game ID (right) */}
        <input
          name="blueTeam"
          required
          value={blueTeam}
          onChange={(e) => setBlueTeam(e.target.value)}
          placeholder="Blue Team Name"
          className="xp-inset px-2 py-1 text-xs"
        />
        <input
          name="redTeam"
          required
          value={redTeam}
          onChange={(e) => setRedTeam(e.target.value)}
          placeholder="Red Team Name"
          className="xp-inset px-2 py-1 text-xs"
        />
        <input
          name="gameId"
          required
          value={gameId}
          onChange={(e) => setGameId(e.target.value)}
          placeholder="Game ID (e.g. 5680632994)"
          className="xp-inset px-2 py-1 text-xs"
        />

        {/* Row 2: Blue Bans (left), Red Bans (middle), Draft URL (right) */}
        <ChampionMultiInput
          label="Blue Bans (B1-B5)"
          value={blueBans}
          onChange={setBlueBans}
          allChampions={allChampions}
          ddVersion={ddVersion}
        />
        <ChampionMultiInput
          label="Red Bans (R1-R5)"
          value={redBans}
          onChange={setRedBans}
          allChampions={allChampions}
          ddVersion={ddVersion}
        />
        <input
          name="sourceUrl"
          value={sourceUrl}
          onChange={(e) => setSourceUrl(e.target.value)}
          placeholder="Draft URL (optional)"
          className="xp-inset px-2 py-1 text-xs"
        />

        {/* Row 3: Blue Picks (left), Red Picks (middle), Save button (right) */}
        <ChampionMultiInput
          label="Blue Picks (B1-B5 in order)"
          value={bluePicks}
          onChange={setBluePicks}
          allChampions={allChampions}
          ddVersion={ddVersion}
        />
        <ChampionMultiInput
          label="Red Picks (R1-R5 in order)"
          value={redPicks}
          onChange={setRedPicks}
          allChampions={allChampions}
          ddVersion={ddVersion}
        />
        <button
          type="submit"
          disabled={saving}
          className="xp-btn xp-btn-primary text-xs justify-center"
        >
          {saving ? "Saving..." : "Save Draft to DB"}
        </button>
      </form>
    </details>
  );
}
