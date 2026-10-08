import { Plus, Upload } from 'lucide-react';

import { Button, IconButton, buttonVariants } from '#app/components/ui/button';
import { Checkbox } from '#app/components/ui/checkbox';
import { Field, controlVariants, fieldVariants } from '#app/components/ui/field';
import { Input } from '#app/components/ui/input';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '#app/components/ui/select';
import { Switch } from '#app/components/ui/switch';
import { Textarea } from '#app/components/ui/textarea';
import { variantNames } from '#app/components/ui/variant-names';
import { ShowcaseSection } from './showcase-section';

const BUTTON_VARIANTS = variantNames(buttonVariants.variants.variant);
const BUTTON_SIZES = variantNames(buttonVariants.variants.size);
const CONTROL_SIZES = variantNames(controlVariants.variants.size);

export function FormControls() {
  return (
    <>
      <ShowcaseSection title="Button">
        {BUTTON_SIZES.map((size) => (
          <div key={size} className="tw:flex tw:flex-wrap tw:items-center tw:gap-2">
            {BUTTON_VARIANTS.map((variant) => (
              <Button key={variant} variant={variant} size={size}>
                <Upload aria-hidden="true" />
                {`${variant} ${size}`}
              </Button>
            ))}
            <IconButton size={size} aria-label={`Add, ${size}`}>
              <Plus aria-hidden="true" />
            </IconButton>
            <Button size={size} disabled>
              Disabled
            </Button>
          </div>
        ))}
        <div>
          <Button asChild variant="outline">
            <a href="/">A link styled as a button</a>
          </Button>
        </div>
      </ShowcaseSection>

      <ShowcaseSection title="Field, Input, Textarea">
        {CONTROL_SIZES.map((size) => (
          <Field key={size} label={`Title, ${size}`} description="Shown on the watch page">
            <Input size={size} placeholder="Add a title" />
          </Field>
        ))}
        {variantNames(fieldVariants.variants.orientation).map((orientation) => (
          <Field
            key={orientation}
            label={`Handle, ${orientation}`}
            orientation={orientation}
            description="Letters, digits and dots"
          >
            <Input />
          </Field>
        ))}
        <Field label="Title" error="A title is required">
          <Input defaultValue="" />
        </Field>
        <Field label="Disabled">
          <Input disabled defaultValue="Read only" />
        </Field>
        <Field label="Description" description="Up to 5000 characters">
          <Textarea placeholder="Tell viewers about your video" />
        </Field>
      </ShowcaseSection>

      <ShowcaseSection title="Select">
        {CONTROL_SIZES.map((size) => (
          <Field key={size} label={`Visibility, ${size}`}>
            <Select defaultValue="public">
              <SelectTrigger size={size}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>Listed</SelectLabel>
                  <SelectItem value="public">Public</SelectItem>
                </SelectGroup>
                <SelectSeparator />
                <SelectItem value="unlisted">Unlisted</SelectItem>
                <SelectItem value="private">Private</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        ))}
      </ShowcaseSection>

      <ShowcaseSection title="Checkbox, Switch">
        <Field label="Unchecked" orientation="horizontal">
          <Checkbox />
        </Field>
        <Field label="Checked" orientation="horizontal">
          <Checkbox defaultChecked />
        </Field>
        <Field label="Indeterminate" orientation="horizontal">
          <Checkbox checked="indeterminate" />
        </Field>
        <Field label="Disabled" orientation="horizontal">
          <Checkbox disabled />
        </Field>
        <Field label="Autoplay next" orientation="horizontal" description="Plays the next video">
          <Switch defaultChecked />
        </Field>
        <Field label="Disabled switch" orientation="horizontal">
          <Switch disabled />
        </Field>
      </ShowcaseSection>
    </>
  );
}
