"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useToast } from "@/components/ToastProvider";
import { Button } from "@/ui/components/Button";
import { Input } from "@/components/ui/ui/input";
import { Label } from "@/components/ui/ui/label";
import { Music, Download, Loader2, ExternalLink } from "lucide-react";
import { Breadcrumbs } from "@/ui/components/Breadcrumbs";

type Track = {
  title: string;
  artist: string;
  url?: string;
};

export default function LinkResolverPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [playlistTitle, setPlaylistTitle] = useState<string>("");

  const handleResolve = async () => {
    if (!url.trim()) {
      toast({ title: "Error", description: "Please enter a SoundCloud playlist URL" });
      return;
    }

    // Validate SoundCloud URL
    if (!url.includes("soundcloud.com")) {
      toast({ title: "Error", description: "Please enter a valid SoundCloud URL" });
      return;
    }

    setLoading(true);
    setTracks([]);
    setPlaylistTitle("");

    try {
      const result = await api<{ tracks: Track[]; playlist_title?: string }>("/link-resolver/soundcloud", {
        method: "POST",
        body: { url: url.trim() }
      });

      if (result.tracks && result.tracks.length > 0) {
        setTracks(result.tracks);
        setPlaylistTitle(result.playlist_title || "");
        toast({ title: "Success", description: `Found ${result.tracks.length} tracks` });
      } else {
        toast({ title: "No tracks found", description: "Could not extract tracks from this playlist" });
      }
    } catch (e: any) {
      console.error("Failed to resolve link:", e);
      toast({
        title: "Failed to resolve link",
        description: e?.message || "Could not parse the SoundCloud playlist. Make sure the URL is public and accessible."
      });
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    if (tracks.length === 0) {
      toast({ title: "No data", description: "No tracks to export" });
      return;
    }

    // Create CSV content
    const headers = ["Track Title", "Artist"];
    const rows = tracks.map(track => [
      `"${track.title.replace(/"/g, '""')}"`,
      `"${track.artist.replace(/"/g, '""')}"`
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.join(","))
    ].join("\n");

    // Create blob and download
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `${playlistTitle || "soundcloud-playlist"}-tracks.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({ title: "Exported", description: `Exported ${tracks.length} tracks to CSV` });
  };

  return (
    <div className="flex w-full flex-col gap-6">
      <Breadcrumbs>
        <Breadcrumbs.Item>Home</Breadcrumbs.Item>
        <Breadcrumbs.Divider />
        <Breadcrumbs.Item active={true}>Link Resolver</Breadcrumbs.Item>
      </Breadcrumbs>

      <div className="flex w-full flex-col items-start gap-1">
        <span className="text-heading-1 font-heading-1 text-default-font">Link Resolver</span>
        <span className="text-body font-body text-subtext-color">
          Extract track information from SoundCloud playlists
        </span>
      </div>

      <div className="flex w-full flex-col gap-6 rounded-xl border border-neutral-border bg-white dark:bg-neutral-800 p-6 shadow-sm">
        <div className="flex w-full flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="url">SoundCloud Playlist URL</Label>
            <div className="flex gap-2">
              <Input
                id="url"
                type="url"
                placeholder="https://soundcloud.com/username/sets/playlist-name"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="flex-1"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !loading) {
                    handleResolve();
                  }
                }}
              />
              <Button
                onClick={handleResolve}
                disabled={loading || !url.trim()}
                icon={loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Music className="h-4 w-4" />}
              >
                {loading ? "Resolving..." : "Resolve"}
              </Button>
            </div>
            <p className="text-sm text-subtext-color">
              Paste a public SoundCloud playlist URL to extract track names and artists
            </p>
          </div>

          {playlistTitle && (
            <div className="rounded-lg bg-neutral-50 dark:bg-neutral-900 p-4">
              <h3 className="text-body-bold font-body-bold text-default-font mb-2">
                {playlistTitle}
              </h3>
              <p className="text-caption text-subtext-color">
                {tracks.length} track{tracks.length !== 1 ? "s" : ""} found
              </p>
            </div>
          )}

          {tracks.length > 0 && (
            <>
              <div className="flex items-center justify-between">
                <h3 className="text-heading-2 font-heading-2 text-default-font">
                  Tracks ({tracks.length})
                </h3>
                <Button
                  onClick={handleExport}
                  variant="neutral-secondary"
                  icon={<Download className="h-4 w-4" />}
                >
                  Export CSV
                </Button>
              </div>

              <div className="max-h-[600px] overflow-y-auto rounded-lg border border-neutral-border">
                <table className="w-full">
                  <thead className="bg-neutral-50 dark:bg-neutral-900 sticky top-0">
                    <tr>
                      <th className="px-4 py-3 text-left text-caption-bold font-caption-bold text-subtext-color border-b border-neutral-border">
                        #
                      </th>
                      <th className="px-4 py-3 text-left text-caption-bold font-caption-bold text-subtext-color border-b border-neutral-border">
                        Track Title
                      </th>
                      <th className="px-4 py-3 text-left text-caption-bold font-caption-bold text-subtext-color border-b border-neutral-border">
                        Artist
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {tracks.map((track, index) => (
                      <tr
                        key={index}
                        className="border-b border-neutral-border hover:bg-neutral-50 dark:hover:bg-neutral-900/50 transition-colors"
                      >
                        <td className="px-4 py-3 text-body text-subtext-color">
                          {index + 1}
                        </td>
                        <td className="px-4 py-3 text-body text-default-font">
                          {track.title}
                        </td>
                        <td className="px-4 py-3 text-body text-default-font">
                          {track.artist}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
