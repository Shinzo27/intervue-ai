"use client";

import { useState, type ReactNode } from "react";
import { BriefcaseBusiness, Inbox, Plus, Settings, Sparkles, Trash2, Upload } from "lucide-react";
import { Alert } from "@repo/ui/alert";
import { Avatar } from "@repo/ui/avatar";
import { Badge } from "@repo/ui/badge";
import { Button, IconButton } from "@repo/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@repo/ui/card";
import { Checkbox } from "@repo/ui/checkbox";
import { CommandPalette, CommandPaletteTrigger } from "@repo/ui/command-palette";
import { ConfirmDialog } from "@repo/ui/confirm-dialog";
import { Container } from "@repo/ui/container";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@repo/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui/dropdown-menu";
import { EmptyState } from "@repo/ui/empty-state";
import { Field } from "@repo/ui/field";
import { Input, Textarea } from "@repo/ui/input";
import { Kbd } from "@repo/ui/kbd";
import { Popover, PopoverContent, PopoverTrigger } from "@repo/ui/popover";
import { Progress } from "@repo/ui/progress";
import { RadioGroup } from "@repo/ui/radio-group";
import { Select } from "@repo/ui/select";
import { Separator } from "@repo/ui/separator";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@repo/ui/sheet";
import { Skeleton } from "@repo/ui/skeleton";
import { Spinner } from "@repo/ui/spinner";
import { Switch } from "@repo/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@repo/ui/tabs";
import { ThemeToggle } from "@repo/ui/theme-toggle";
import { toast } from "@repo/ui/toast";
import { Tooltip, TooltipProvider } from "@repo/ui/tooltip";

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        {description && <p className="text-sm text-muted-fg">{description}</p>}
      </div>
      <Card>
        <CardContent className="space-y-5">{children}</CardContent>
      </Card>
    </section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-3 md:grid-cols-[160px_1fr] md:items-center">
      <p className="text-xs font-medium uppercase tracking-wider text-subtle-fg">{label}</p>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  );
}

const swatches = [
  ["bg", "bg-bg"],
  ["surface", "bg-surface"],
  ["surface-2", "bg-surface-2"],
  ["primary", "bg-primary"],
  ["ai", "bg-ai"],
  ["success", "bg-success"],
  ["warning", "bg-warning"],
  ["danger", "bg-danger"],
  ["accent", "bg-accent"],
] as const;

export function UiKit() {
  const [loading, setLoading] = useState(false);
  const [notify, setNotify] = useState(true);
  const [stage, setStage] = useState("screen");

  return (
    <TooltipProvider>
      <header className="sticky top-0 z-30 border-b border-border bg-surface">
        <Container className="flex h-14 items-center gap-3">
          <span className="grid size-8 place-items-center rounded-md bg-primary text-on-primary">
            <Sparkles className="size-4" aria-hidden />
          </span>
          <h1 className="text-base font-semibold">Intervue AI · UI kit</h1>
          <Badge variant="warning">Dev only</Badge>
          <div className="ml-auto flex items-center gap-2">
            <CommandPaletteTrigger className="hidden w-56 sm:flex" />
            <ThemeToggle />
          </div>
        </Container>
      </header>

      <Container className="space-y-10 py-8">
        <Section title="Colour tokens" description="Semantic tokens only; toggle the theme to check both.">
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-9">
            {swatches.map(([name, cls]) => (
              <div key={name} className="space-y-1.5">
                <div className={`h-12 rounded-md border border-border ${cls}`} />
                <p className="font-mono text-xs text-muted-fg">{name}</p>
              </div>
            ))}
          </div>
          <Separator />
          <div className="space-y-1">
            <p className="text-4xl font-bold tracking-tight">Hire with calm precision</p>
            <p className="text-2xl font-semibold">Heading 3 · Plus Jakarta Sans</p>
            <p className="text-base">Body 16 — the AI asks, scores and recommends; a human decides.</p>
            <p className="text-sm text-muted-fg">Body small 14 — secondary text in tables and labels.</p>
            <p className="tabular font-mono text-sm">Score 82.5 · app_7e6a067f · 2026-11-28 14:02</p>
          </div>
        </Section>

        <Section title="Buttons">
          <Row label="Variants">
            <Button>Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="destructive">Delete</Button>
            <Button variant="link">Link</Button>
          </Row>
          <Row label="Sizes & icons">
            <Button size="sm">
              <Plus /> Small
            </Button>
            <Button>
              <Plus /> New pipeline
            </Button>
            <Button size="lg">
              <Upload /> Large
            </Button>
            <Tooltip content="Settings">
              <IconButton aria-label="Settings">
                <Settings />
              </IconButton>
            </Tooltip>
            <IconButton aria-label="Delete" variant="secondary">
              <Trash2 />
            </IconButton>
          </Row>
          <Row label="States">
            <Button
              loading={loading}
              onClick={() => {
                setLoading(true);
                window.setTimeout(() => setLoading(false), 1500);
              }}
            >
              Publish version
            </Button>
            <Button disabled>Disabled</Button>
            <Button variant="secondary" disabled>
              Disabled
            </Button>
          </Row>
        </Section>

        <Section title="Badges & status" description="AI-authored items use the violet AI tone; review flags use warning.">
          <Row label="Tones">
            <Badge>Draft</Badge>
            <Badge variant="primary">Published</Badge>
            <Badge variant="ai" dot>
              AI decision
            </Badge>
            <Badge variant="success" dot>
              Pass
            </Badge>
            <Badge variant="warning" dot>
              Needs review
            </Badge>
            <Badge variant="danger" dot>
              Fail
            </Badge>
            <Badge variant="outline">v3</Badge>
          </Row>
          <Row label="Avatars & keys">
            <Avatar name="Ada Lovelace" size="sm" />
            <Avatar name="Grace Hopper" />
            <Avatar name="Alan Turing" size="lg" />
            <span className="text-sm text-muted-fg">
              Open the palette with <Kbd>⌘</Kbd> <Kbd>K</Kbd>
            </span>
          </Row>
        </Section>

        <Section title="Forms" description="Labels are always visible; hints and errors are linked to the control.">
          <div className="grid gap-5 md:grid-cols-2">
            <Field label="Job title" hint="Shown to candidates on the welcome screen." required>
              <Input placeholder="Senior backend engineer" />
            </Field>
            <Field label="Work email" error="Enter an email address like name@company.com.">
              <Input type="email" defaultValue="ada@" />
            </Field>
            <Field label="Pipeline">
              <Select
                placeholder="Choose a pipeline"
                options={[
                  { value: "backend", label: "Backend engineering" },
                  { value: "design", label: "Product design" },
                  { value: "sales", label: "Account executive", disabled: true },
                ]}
              />
            </Field>
            <Field label="Read-only token">
              <Input readOnly value="inv_2f9c…a71b" className="font-mono" />
            </Field>
            <Field label="Rubric notes" className="md:col-span-2">
              <Textarea placeholder="What does a strong answer include?" />
            </Field>
            <Field label="Email me when an interview completes" inline>
              <Switch checked={notify} onCheckedChange={setNotify} />
            </Field>
            <Field label="Require human review for every decision" inline>
              <Checkbox defaultChecked />
            </Field>
            <div className="md:col-span-2">
              <p className="mb-3 text-sm font-medium">Question type</p>
              <RadioGroup
                value={stage}
                onValueChange={setStage}
                options={[
                  { value: "screen", label: "Free text", description: "Scored against rubric criteria." },
                  { value: "mcq", label: "Multiple choice", description: "Exact-match scoring." },
                  { value: "code", label: "Code", description: "Coming later.", disabled: true },
                ]}
              />
            </div>
          </div>
        </Section>

        <Section title="Feedback">
          <div className="grid gap-3 md:grid-cols-2">
            <Alert title="Version 3 published">Jobs on this pipeline keep using their frozen version.</Alert>
            <Alert variant="success" title="Invitation sent">Ada will receive the interview link by email.</Alert>
            <Alert variant="warning" title="Models disagree by 28 points">This answer is flagged for human review.</Alert>
            <Alert variant="danger" title="Couldn't load applications">Check your connection and try again.</Alert>
          </div>
          <Row label="Toasts">
            <Button variant="secondary" onClick={() => toast.success("Decision saved", "The previous outcome is kept in the audit trail.")}>
              Success toast
            </Button>
            <Button variant="secondary" onClick={() => toast.error("Publish failed", "Add at least one question to each stage.")}>
              Error toast
            </Button>
            <Button variant="secondary" onClick={() => toast.info("Link copied")}>
              Info toast
            </Button>
          </Row>
          <Row label="Progress">
            <div className="w-full max-w-md space-y-3">
              <Progress value={82} label="Overall score" tone="success" />
              <Progress value={54} label="Interview progress" />
              <Progress value={31} label="Criterion score" tone="danger" />
            </div>
          </Row>
          <Row label="Loading">
            <Spinner label="Loading" />
            <div className="w-full max-w-md space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-9 w-full" />
            </div>
          </Row>
          <EmptyState
            icon={Inbox}
            title="No applications yet"
            description="Publish a job and invite a candidate; their interview will appear here."
            action={
              <Button>
                <BriefcaseBusiness /> Go to jobs
              </Button>
            }
          />
        </Section>

        <Section title="Overlays & navigation" description="Focus is trapped, Esc closes, focus returns to the trigger.">
          <Row label="Dialogs">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="secondary">Open dialog</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Invite a teammate</DialogTitle>
                  <DialogDescription>They&apos;ll get an email with a link to join this organization.</DialogDescription>
                </DialogHeader>
                <DialogBody className="space-y-4">
                  <Field label="Email" required>
                    <Input type="email" placeholder="name@company.com" />
                  </Field>
                </DialogBody>
                <DialogFooter>
                  <Button variant="secondary">Cancel</Button>
                  <Button>Send invite</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <ConfirmDialog
              trigger={<Button variant="secondary">Publish job</Button>}
              title="Publish this job?"
              description="Publishing freezes pipeline version 3 for this job. Later pipeline edits won't affect it."
              confirmLabel="Publish"
              onConfirm={() => new Promise((resolve) => window.setTimeout(resolve, 900))}
            />
            <ConfirmDialog
              trigger={<Button variant="destructive">Delete pipeline</Button>}
              title="Delete this pipeline?"
              description="Draft changes are lost. Published versions used by jobs are kept."
              confirmLabel="Delete"
              destructive
              onConfirm={() => toast.success("Pipeline deleted")}
            />
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="secondary">Open sheet</Button>
              </SheetTrigger>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle className="text-lg font-semibold">Invite candidate</SheetTitle>
                  <SheetDescription className="text-sm text-muted-fg">
                    Creates the application and a one-time interview link.
                  </SheetDescription>
                </SheetHeader>
                <SheetBody className="space-y-4">
                  <Field label="First name" required>
                    <Input />
                  </Field>
                  <Field label="Email" required>
                    <Input type="email" />
                  </Field>
                </SheetBody>
                <SheetFooter>
                  <Button>Create invite</Button>
                </SheetFooter>
              </SheetContent>
            </Sheet>
          </Row>
          <Row label="Menus">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary">Row actions</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuLabel>Backend engineer</DropdownMenuLabel>
                <DropdownMenuItem>
                  <Settings /> Edit
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem destructive>
                  <Trash2 /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="secondary">Score details</Button>
              </PopoverTrigger>
              <PopoverContent>
                <p className="text-sm font-semibold">Clarity · 4 / 5</p>
                <p className="mt-1 text-sm text-muted-fg">Explains trade-offs with a concrete example.</p>
              </PopoverContent>
            </Popover>
          </Row>
          <Tabs defaultValue="overview">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="candidates">Candidates</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
            </TabsList>
            <TabsContent value="overview" className="text-sm text-muted-fg">Overview tab content.</TabsContent>
            <TabsContent value="candidates" className="text-sm text-muted-fg">Candidates tab content.</TabsContent>
            <TabsContent value="settings" className="text-sm text-muted-fg">Settings tab content.</TabsContent>
          </Tabs>
        </Section>

        <Section title="Cards">
          <div className="grid gap-4 md:grid-cols-3">
            {["Open jobs", "In progress", "Needs review"].map((title, index) => (
              <Card key={title}>
                <CardHeader>
                  <CardDescription>{title}</CardDescription>
                  <CardTitle className="tabular text-3xl">{[12, 7, 3][index]}</CardTitle>
                </CardHeader>
                <CardContent className="pt-3 text-sm text-muted-fg">Updated just now</CardContent>
                <CardFooter>
                  <Button size="sm" variant="ghost">
                    View all
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        </Section>
      </Container>

      <CommandPalette
        groups={[
          {
            heading: "Demo",
            items: [{ id: "toast", label: "Show a toast", icon: Sparkles, onSelect: () => toast.info("From the palette") }],
          },
        ]}
      />
    </TooltipProvider>
  );
}
