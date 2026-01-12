"use client";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ToastProvider";
import Link from "next/link";
import { Download, Plus, Search, Star, Eye, MoreHorizontal, Edit, Tag as TagIcon, Trash } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/subframe/Avatar";
import { Badge } from "@/components/subframe/Badge";
import { Button } from "@/components/subframe/Button";
import { IconButton } from "@/components/subframe/IconButton";
import { TextField } from "@/components/subframe/TextField";
import { Table } from "@/components/subframe/Table";
import { Checkbox } from "@/components/subframe/Checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/ui/dropdown-menu";

type PNM = {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  major?: string;
  hometown?: string;
  year?: string;
  tags?: string[];
  photo_url?: string | null;
  attendance_count?: number;
  total_events?: number;
  yes_percentage?: number;
  is_favorite?: boolean;
};

export default function PNMsPage() {
  const [pnms, setPnms] = useState<PNM[]>([]);
  const [search, setSearch] = useState("");
  const [chapterId, setChapterId] = useState<string | null>(null);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [showEmailColumn, setShowEmailColumn] = useState(false);
  const [showPhoneColumn, setShowPhoneColumn] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    (async () => {
      try {
        const chapters = await api<{ id: string; name: string }[]>("/chapters");
        const cid = chapters[0]?.id;
        setChapterId(cid || null);
        if (cid) {
          const data = await api<PNM[]>(`/pnms?chapter_id=${cid}`);
          setPnms(data);
          
          const tags = new Set<string>();
          data.forEach((pnm) => {
            (pnm.tags || []).forEach((tag) => tags.add(tag));
          });
          setAllTags(Array.from(tags).sort());
        }
      } catch (e: any) {
        toast({ title: "Failed to load PNMs", description: e.message });
      }
    })();
  }, [toast]);

  const filtered = useMemo(() => {
    let result = pnms;
    
    const s = search.trim().toLowerCase();
    if (s) {
      result = result.filter((p) =>
        [p.name, p.major || "", p.hometown || "", p.email || "", p.phone || ""].some((f) =>
          f.toLowerCase().includes(s)
        )
      );
    }
    
    if (selectedTags.length > 0) {
      result = result.filter((p) => selectedTags.some((tag) => (p.tags || []).includes(tag)));
    }
    
    return result;
  }, [pnms, search, selectedTags]);

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  };

  return (
    <div className="flex h-full w-full flex-col gap-6">
      {/* Header & Filters */}
      <div className="flex w-full flex-col gap-4">
        <div className="flex w-full items-center gap-4 flex-wrap">
          <div className="flex-1 min-w-[300px]">
            <TextField icon={<Search className="w-4 h-4" />}>
              <TextField.Input
                placeholder="Search PNMs..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </TextField>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="neutral-secondary"
              icon={<Download className="w-4 h-4" />}
              onClick={() => {
                if (chapterId) {
                  window.open(`${process.env.NEXT_PUBLIC_API_BASE_URL}/export/csv?entity=pnms&chapter_id=${chapterId}`, "_blank");
                }
              }}
            >
              Export CSV
            </Button>
            <Link href="/intake">
              <Button icon={<Plus className="w-4 h-4" />}>Add PNM</Button>
            </Link>
          </div>
        </div>

        {/* Column Visibility Toggles */}
        <div className="flex items-center gap-4">
          <Checkbox
            checked={showEmailColumn}
            onCheckedChange={setShowEmailColumn}
            label="Show Email"
          />
          <Checkbox
            checked={showPhoneColumn}
            onCheckedChange={setShowPhoneColumn}
            label="Show Phone"
          />
        </div>

        {/* Tag Filters */}
        {allTags.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Filter by tags:
            </span>
            {allTags.map((tag) => (
              <button
                key={tag}
                onClick={() => toggleTag(tag)}
                className={cn(
                  selectedTags.includes(tag)
                    ? "bg-beta-navy text-white"
                    : "bg-beta-navy/10 text-beta-navy hover:bg-beta-navy/20"
                )}
                style={{ padding: "4px 12px", borderRadius: "9999px", fontSize: "12px", fontWeight: 500 }}
              >
                {tag}
              </button>
            ))}
            {selectedTags.length > 0 && (
              <Button
                variant="neutral-tertiary"
                size="small"
                icon={<span>×</span>}
                onClick={() => setSelectedTags([])}
              >
                Clear filters
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Table */}
      <div className="flex w-full flex-col rounded-xl border border-beta-gray/30 bg-white dark:bg-neutral-900 shadow-sm overflow-auto">
        <Table
          header={
            <thead>
              <Table.HeaderRow>
                <Table.HeaderCell>Photo</Table.HeaderCell>
                <Table.HeaderCell>Name</Table.HeaderCell>
                <Table.HeaderCell>Major</Table.HeaderCell>
                <Table.HeaderCell>Hometown</Table.HeaderCell>
                {showEmailColumn && <Table.HeaderCell>Email</Table.HeaderCell>}
                {showPhoneColumn && <Table.HeaderCell>Phone</Table.HeaderCell>}
                <Table.HeaderCell>Tags</Table.HeaderCell>
                <Table.HeaderCell>Attendance</Table.HeaderCell>
                <Table.HeaderCell>Yes %</Table.HeaderCell>
                <Table.HeaderCell>Favorites</Table.HeaderCell>
                <Table.HeaderCell>Actions</Table.HeaderCell>
              </Table.HeaderRow>
            </thead>
          }
        >
          {filtered.map((pnm) => (
            <Table.Row key={pnm.id} clickable>
              <Table.Cell>
                <Avatar size="large" image={pnm.photo_url || undefined}>
                  {pnm.name.slice(0, 2).toUpperCase()}
                </Avatar>
              </Table.Cell>
              <Table.Cell>
                <span className="font-semibold text-beta-navy dark:text-white whitespace-nowrap">
                  {pnm.name}
                </span>
              </Table.Cell>
              <Table.Cell>
                <span className="text-muted-foreground whitespace-nowrap">{pnm.major || "—"}</span>
              </Table.Cell>
              <Table.Cell>
                <span className="text-muted-foreground whitespace-nowrap">{pnm.hometown || "—"}</span>
              </Table.Cell>
              {showEmailColumn && (
                <Table.Cell>
                  <span className="text-muted-foreground text-xs">{pnm.email || "—"}</span>
                </Table.Cell>
              )}
              {showPhoneColumn && (
                <Table.Cell>
                  <span className="text-muted-foreground text-xs">{pnm.phone || "—"}</span>
                </Table.Cell>
              )}
              <Table.Cell>
                <div className="flex items-center gap-1">
                  {(pnm.tags || []).slice(0, 2).map((tag) => (
                    <Badge key={tag}>{tag}</Badge>
                  ))}
                  {(pnm.tags || []).length > 2 && (
                    <Badge variant="neutral">+{(pnm.tags || []).length - 2}</Badge>
                  )}
                </div>
              </Table.Cell>
              <Table.Cell>
                <span className="text-muted-foreground whitespace-nowrap">
                  {pnm.attendance_count || 0}/{pnm.total_events || 6} events
                </span>
              </Table.Cell>
              <Table.Cell>
                {pnm.yes_percentage !== undefined ? (
                  <span
                    className={cn(
                      "font-semibold whitespace-nowrap",
                      pnm.yes_percentage >= 85 ? "text-green-600" : pnm.yes_percentage >= 70 ? "text-beta-navy" : "text-muted-foreground"
                    )}
                  >
                    {pnm.yes_percentage}%
                  </span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </Table.Cell>
              <Table.Cell>
                <Star
                  className={cn(
                    "w-4 h-4",
                    pnm.is_favorite ? "text-yellow-500 fill-yellow-500" : "text-neutral-300"
                  )}
                />
              </Table.Cell>
              <Table.Cell>
                <div className="flex items-center justify-end gap-1">
                  <Link href={`/pnms/${pnm.id}`}>
                    <IconButton size="small" icon={<Eye className="w-4 h-4" />} />
                  </Link>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="w-8 h-8 rounded-full hover:bg-beta-navy/5 flex items-center justify-center">
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>
                        <Edit className="w-4 h-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <TagIcon className="w-4 h-4 mr-2" />
                        Manage Tags
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Download className="w-4 h-4 mr-2" />
                        Export Graphic
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-red-600">
                        <Trash className="w-4 h-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </Table.Cell>
            </Table.Row>
          ))}
          {filtered.length === 0 && (
            <tr>
              <td colSpan={showEmailColumn && showPhoneColumn ? 12 : showEmailColumn || showPhoneColumn ? 11 : 10} className="px-4 py-12 text-center text-muted-foreground">
                {search || selectedTags.length > 0 ? "No PNMs match your filters." : "No PNMs yet. Add one to get started!"}
              </td>
            </tr>
          )}
        </Table>
      </div>

      {/* Pagination Placeholder */}
      <div className="flex w-full items-center justify-between text-sm text-muted-foreground">
        <span>Showing {filtered.length} of {pnms.length} PNMs</span>
      </div>
    </div>
  );
}
