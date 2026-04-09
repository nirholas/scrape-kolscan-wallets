"use client";

import ProfileExportButton from "./ProfileExportButton";
import ShareButtons from "./ShareButtons";

interface ProfileData {
  wallet_address: string;
  name: string;
  chain?: "sol" | "bsc";
  twitter?: string | null;
  telegram?: string | null;
  profit?: number;
  wins?: number;
  losses?: number;
  winrate?: number;
  [key: string]: unknown;
}

export default function ProfileActions({
  profile,
  shareTitle,
}: {
  profile: ProfileData;
  shareTitle?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <ProfileExportButton profile={profile} />
      <ShareButtons title={shareTitle || `${profile.name} on KolQuest`} />
    </div>
  );
}
