import { Avatar, avatarVariants } from '#app/components/ui/avatar';
import { Badge, badgeVariants } from '#app/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '#app/components/ui/card';
import { Field } from '#app/components/ui/field';
import { Progress, progressVariants } from '#app/components/ui/progress';
import { Separator } from '#app/components/ui/separator';
import { Skeleton } from '#app/components/ui/skeleton';
import { Spinner, spinnerVariants } from '#app/components/ui/spinner';
import { variantNames } from '#app/components/ui/variant-names';
import { ShowcaseSection } from './showcase-section';

export function Display() {
  return (
    <>
      <ShowcaseSection title="Badge">
        <div className="tw:flex tw:flex-wrap tw:gap-2">
          {variantNames(badgeVariants.variants.variant).map((variant) => (
            <Badge key={variant} variant={variant}>
              {variant}
            </Badge>
          ))}
        </div>
      </ShowcaseSection>

      <ShowcaseSection title="Avatar">
        <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-3">
          {variantNames(avatarVariants.variants.size).map((size) => (
            <Avatar key={size} size={size} name={`Picture ${size}`} src="/logo192.png" />
          ))}
          {variantNames(avatarVariants.variants.size).map((size) => (
            <Avatar key={size} size={size} name={`Monogram ${size}`} />
          ))}
        </div>
      </ShowcaseSection>

      <ShowcaseSection title="Card, Separator">
        <Card>
          <CardHeader>
            <CardTitle>Channel analytics</CardTitle>
            <CardDescription>Last 28 days</CardDescription>
          </CardHeader>
          <Separator />
          <CardContent>Views and watch time land here.</CardContent>
          <CardFooter>
            <Badge variant="success">Live</Badge>
          </CardFooter>
        </Card>
      </ShowcaseSection>

      <ShowcaseSection title="Skeleton">
        <div className="tw:flex tw:items-center tw:gap-3">
          <Skeleton className="tw:size-9 tw:rounded-full" />
          <div className="tw:flex tw:flex-1 tw:flex-col tw:gap-2">
            <Skeleton className="tw:h-4 tw:w-3/4" />
            <Skeleton className="tw:h-4 tw:w-1/2" />
          </div>
        </div>
      </ShowcaseSection>

      <ShowcaseSection title="Spinner, Progress">
        <div className="tw:flex tw:items-center tw:gap-3">
          {variantNames(spinnerVariants.variants.size).map((size) => (
            <Spinner key={size} size={size} label={`Loading, ${size}`} />
          ))}
        </div>
        {variantNames(progressVariants.variants.size).map((size) => (
          <Field key={size} label={`Uploading, ${size}`}>
            <Progress size={size} value={40} max={100} />
          </Field>
        ))}
        <Field label="Processing">
          <Progress />
        </Field>
      </ShowcaseSection>
    </>
  );
}
