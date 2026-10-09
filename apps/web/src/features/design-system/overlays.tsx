import { EllipsisVertical, ThumbsUp } from 'lucide-react';
import { useState } from 'react';

import { Button, IconButton } from '#app/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '#app/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '#app/components/ui/dropdown-menu';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  sheetVariants,
} from '#app/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '#app/components/ui/tabs';
import { ThemeMenu } from '#app/components/ui/theme/theme-menu';
import { toastVariants, useToast } from '#app/components/ui/toast';
import { Tooltip, TooltipContent, TooltipRoot, TooltipTrigger } from '#app/components/ui/tooltip';
import { variantNames } from '#app/components/ui/variant-names';
import { ShowcaseSection } from './showcase-section';

const TOOLTIP_SIDES = ['top', 'right', 'bottom', 'left'] as const;

function VideoMenu() {
  const [quality, setQuality] = useState('auto');
  const [captions, setCaptions] = useState(true);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <IconButton aria-label="More actions">
          <EllipsisVertical aria-hidden="true" />
        </IconButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuGroup>
          <DropdownMenuItem>
            Share
            <DropdownMenuShortcut>S</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuCheckboxItem checked={captions} onCheckedChange={setCaptions}>
            Captions
          </DropdownMenuCheckboxItem>
        </DropdownMenuGroup>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>Quality</DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuLabel>Quality</DropdownMenuLabel>
            <DropdownMenuRadioGroup value={quality} onValueChange={setQuality}>
              <DropdownMenuRadioItem value="auto">Auto</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="1080p">1080p</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="720p">720p</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled>Report</DropdownMenuItem>
        <DropdownMenuItem variant="destructive">Delete</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ToastButtons() {
  const toast = useToast();

  return (
    <div className="tw:flex tw:flex-wrap tw:gap-2">
      {variantNames(toastVariants.variants.variant).map((variant) => (
        <Button
          key={variant}
          onClick={() =>
            toast({
              variant,
              title: `A ${variant} toast`,
              description: 'It closes on its own',
              action: { label: 'Undo', onAction: () => undefined },
            })
          }
        >
          {`Show ${variant}`}
        </Button>
      ))}
    </div>
  );
}

export function Overlays() {
  return (
    <>
      <ShowcaseSection title="Dialog">
        <div>
          <Dialog>
            <DialogTrigger asChild>
              <Button>Open dialog</Button>
            </DialogTrigger>
            <DialogContent closeLabel="Close">
              <DialogHeader>
                <DialogTitle>Delete video?</DialogTitle>
                <DialogDescription>It cannot be restored.</DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose asChild>
                  <Button>Cancel</Button>
                </DialogClose>
                <Button variant="destructive">Delete</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </ShowcaseSection>

      <ShowcaseSection title="Sheet">
        <div className="tw:flex tw:flex-wrap tw:gap-2">
          {variantNames(sheetVariants.variants.side).map((side) => (
            <Sheet key={side}>
              <SheetTrigger asChild>
                <Button>{`From the ${side}`}</Button>
              </SheetTrigger>
              <SheetContent side={side} closeLabel="Close">
                <SheetHeader>
                  <SheetTitle>Taitube</SheetTitle>
                  <SheetDescription>{`A sheet from the ${side}`}</SheetDescription>
                </SheetHeader>
                <SheetFooter>
                  <SheetClose asChild>
                    <Button>Done</Button>
                  </SheetClose>
                </SheetFooter>
              </SheetContent>
            </Sheet>
          ))}
        </div>
      </ShowcaseSection>

      <ShowcaseSection title="DropdownMenu, ThemeMenu">
        <div className="tw:flex tw:items-center tw:gap-2">
          <VideoMenu />
          <ThemeMenu />
        </div>
      </ShowcaseSection>

      <ShowcaseSection title="Tooltip">
        <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-2">
          <Tooltip content="I like this">
            <IconButton aria-label="Like">
              <ThumbsUp aria-hidden="true" />
            </IconButton>
          </Tooltip>
          {TOOLTIP_SIDES.map((side) => (
            <Tooltip key={side} side={side} content={`Opens on the ${side}`}>
              <Button size="sm">{side}</Button>
            </Tooltip>
          ))}
          <TooltipRoot>
            <TooltipTrigger asChild>
              <Button size="sm">Composed from parts</Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" align="start">
              A long tooltip wraps onto a few balanced lines rather than running off the edge of the
              screen
            </TooltipContent>
          </TooltipRoot>
        </div>
      </ShowcaseSection>

      <ShowcaseSection title="Tabs">
        <Tabs defaultValue="appearance">
          <TabsList aria-label="Settings">
            <TabsTrigger value="appearance">Appearance</TabsTrigger>
            <TabsTrigger value="playback">Playback</TabsTrigger>
            <TabsTrigger value="privacy" disabled>
              Privacy
            </TabsTrigger>
          </TabsList>
          <TabsContent value="appearance">Theme and accent</TabsContent>
          <TabsContent value="playback">Quality and speed</TabsContent>
          <TabsContent value="privacy">History</TabsContent>
        </Tabs>
      </ShowcaseSection>

      <ShowcaseSection title="Toast">
        <ToastButtons />
      </ShowcaseSection>
    </>
  );
}
