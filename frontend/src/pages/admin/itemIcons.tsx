import {
  Package, Shirt, Backpack, BookOpen, Book, NotebookPen, Pencil, Pen,
  Ruler, Scissors, Palette, Calculator, Globe, Trophy, Medal, Award,
  BadgeCheck, Utensils, Bus, Apple, FlaskConical, Microscope, Music,
  Dumbbell, Camera, Printer, Tag, Ticket, GraduationCap, IdCard,
  Star, Flag, ShoppingBag, Glasses, Watch, Footprints, Headphones,
  Sandwich, Umbrella, Key,
} from 'lucide-react';
import type { LucideProps } from 'lucide-react';
import type { ComponentType } from 'react';

export type ItemIconComponent = ComponentType<LucideProps>;

// Lucide has no trousers icon — a minimal outline in Lucide stroke style.
const PantsIcon: ItemIconComponent = ({ size = 24, className }) => (
  <svg
    width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
    className={className} aria-hidden="true"
  >
    <path d="M4 3h16v4H4z" />
    <path d="M6 7l1.5 14h4L12 11l.5 10h4L18 7" />
  </svg>
);

/**
 * Icon catalog for sellable-item badges in the payment ledger.
 * The item stores one of these names in `icon` (or an uploaded image in
 * `iconImage`, which takes precedence). Fallback: Package.
 */
export const ITEM_ICONS: Record<string, ItemIconComponent> = {
  Shirt, Pants: PantsIcon, Backpack, BookOpen, Book, NotebookPen, Pencil, Pen,
  Ruler, Scissors, Palette, Calculator, Globe, Trophy, Medal, Award,
  BadgeCheck, Utensils, Bus, Apple, FlaskConical, Microscope, Music,
  Dumbbell, Camera, Printer, Tag, Ticket, GraduationCap, IdCard,
  Star, Flag, ShoppingBag, Glasses, Watch, Footprints, Headphones,
  Sandwich, Umbrella, Key, Package,
};

/** Renders the badge glyph of a sellable item: image > icon > Package. */
export function ItemGlyph({ icon, iconImage, size = 14, className }: {
  icon?: string | null;
  iconImage?: string | null;
  size?: number;
  className?: string;
}) {
  if (iconImage) {
    return (
      <img
        src={iconImage}
        alt=""
        draggable={false}
        style={{ width: size, height: size }}
        className={`object-contain ${className ?? ''}`}
      />
    );
  }
  const Icon = (icon && ITEM_ICONS[icon]) || Package;
  return <Icon size={size} className={className} />;
}
