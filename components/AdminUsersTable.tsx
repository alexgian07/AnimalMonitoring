"use client";
import { useState } from "react";
import { Profile, Location } from "@/lib/types";

export default function AdminUsersTable({ profiles, locations }: { profiles: Profile[]; locations: Location[] }) {
  const [saving, setSaving] = useState<string | null>(null);

  async function updateUser(id: string, patch: Partial<Profile>) {
    setSaving(id);
    await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...patch }),
    });
    setSaving(null);
    window.location.reload();
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-800 text-gray-500 text-xs uppercase">
            <th className="text-left px-5 py-3">User</th>
            <th className="text-left px-5 py-3">Role</th>
            <th className="text-left px-5 py-3">Location Access</th>
            <th className="px-5 py-3">Actions</th>
          </tr>
        </thead>
        <tbody>
          {profiles.map((p) => (
            <UserRow key={p.id} profile={p} locations={locations} saving={saving === p.id} onUpdate={(patch) => updateUser(p.id, patch)} />
          ))}
        </tbody>
      </table>
      {profiles.length === 0 && (
        <div className="text-center py-12 text-gray-500">No users yet. Users appear here after their first login.</div>
      )}
    </div>
  );
}

function UserRow({ profile, locations, saving, onUpdate }: {
  profile: Profile;
  locations: Location[];
  saving: boolean;
  onUpdate: (patch: Partial<Profile>) => void;
}) {
  const [role, setRole] = useState(profile.role);
  const [allowedLocs, setAllowedLocs] = useState<string[]>(profile.allowed_locations ?? []);
  const allLocations = allowedLocs.length === 0;

  function toggleLocation(locId: string) {
    setAllowedLocs(prev =>
      prev.includes(locId) ? prev.filter(id => id !== locId) : [...prev, locId]
    );
  }

  function save() {
    onUpdate({ role, allowed_locations: allLocations ? null : allowedLocs.length ? allowedLocs : null });
  }

  return (
    <tr className="border-b border-gray-800/50">
      <td className="px-5 py-4">
        <div className="font-medium text-white">{profile.name ?? "—"}</div>
        <div className="text-xs text-gray-500">{profile.email}</div>
      </td>
      <td className="px-5 py-4">
        <select
          value={role}
          onChange={e => setRole(e.target.value as Profile["role"])}
          className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none"
        >
          <option value="viewer">Viewer</option>
          <option value="researcher">Researcher</option>
          <option value="admin">Admin</option>
        </select>
      </td>
      <td className="px-5 py-4">
        <div className="flex flex-wrap gap-1">
          <button
            onClick={() => setAllowedLocs([])}
            className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
              allLocations ? "bg-emerald-600 border-emerald-600 text-white" : "border-gray-700 text-gray-400 hover:border-gray-500"
            }`}
          >
            All
          </button>
          {locations.map(loc => (
            <button
              key={loc.id}
              onClick={() => toggleLocation(loc.id)}
              className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                !allLocations && allowedLocs.includes(loc.id)
                  ? "bg-blue-700 border-blue-600 text-white"
                  : "border-gray-700 text-gray-400 hover:border-gray-500"
              }`}
            >
              {loc.name}
            </button>
          ))}
        </div>
      </td>
      <td className="px-5 py-4 text-center">
        <button
          onClick={save}
          disabled={saving}
          className="text-xs bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg transition-colors"
        >
          {saving ? "Saving..." : "Save"}
        </button>
      </td>
    </tr>
  );
}
