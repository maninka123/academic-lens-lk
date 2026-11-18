import {
  Activity, Atom, Baby, Beaker, Bone, Brain, Briefcase, Bug, Building2, Calculator, ChartColumn,
  Cog, Cpu, Dna, Droplets, FlaskConical, Globe2, GraduationCap, Gavel, HardHat, HeartPulse,
  Landmark, Languages, Layers, Leaf, Lightbulb, Map, Microscope, Mountain, Music, Palette,
  PawPrint, Pickaxe, Pill, Ruler, ScanLine, Scale, Scissors, Search, Shirt, Sigma, Sprout,
  Stethoscope, Syringe, Thermometer, TrendingUp, Truck, Users, Vote, Wheat, Wrench, Zap, BookOpen,
  type LucideIcon,
} from "lucide-react";

type Entry = [RegExp, LucideIcon, number];
/** Faculty-level icons, matched against the faculty name (first match wins). */
const FACULTIES: Entry[] = [
  [/veterinary/i, PawPrint, 24],
  [/agricult/i, Sprout, 142],
  [/allied|nursing|health/i, HeartPulse, 346],
  [/dental/i, Activity, 190],
  [/medicine|medical/i, Stethoscope, 346],
  [/pharmac/i, Pill, 160],
  [/engineering/i, Cog, 28],
  [/architect|built environment/i, Ruler, 38],
  [/information|computing|computer|\bit\b/i, Cpu, 262],
  [/technolog/i, Wrench, 215],
  [/applied science/i, Microscope, 168],
  [/science/i, FlaskConical, 142],
  [/management|business|commerce|finance/i, Briefcase, 215],
  [/\blaw\b/i, Scale, 230],
  [/educat/i, GraduationCap, 200],
  [/social/i, Users, 320],
  [/humanit/i, BookOpen, 18],
  [/arts?\b|music|fine/i, Palette, 18],
  [/language/i, Languages, 18],
  [/graduate|postgraduate/i, GraduationCap, 262],
  [/geomatics|survey/i, Map, 168],
];
/** Department-level icons, matched against the department name. */
const DEPARTMENTS: Entry[] = [
  [/botany|plant/i, Leaf, 142],
  [/zoology|animal|veterinary/i, PawPrint, 24],
  [/crop|soil|agricult/i, Sprout, 142],
  [/food/i, Wheat, 38],
  [/biochem|molecular|biotech|genetic/i, Dna, 262],
  [/biology/i, Dna, 142],
  [/microbio|parasit/i, Bug, 142],
  [/pathology|histo/i, Microscope, 346],
  [/anatomy/i, Bone, 24],
  [/physiology/i, Activity, 346],
  [/pharmacolog/i, Pill, 160],
  [/paediatr|obstetric|gynaec/i, Baby, 320],
  [/psychiatr|psycholog/i, Brain, 300],
  [/surgery/i, Scissors, 346],
  [/radiolog|imaging|nuclear/i, ScanLine, 215],
  [/forensic/i, Search, 230],
  [/anaesth|critical care/i, Syringe, 190],
  [/community|family|public health/i, Users, 346],
  [/medicine|medical/i, Stethoscope, 346],
  [/chemical|process/i, Beaker, 28],
  [/chemistry/i, FlaskConical, 142],
  [/physics/i, Atom, 262],
  [/statistic/i, ChartColumn, 215],
  [/mathemat/i, Sigma, 232],
  [/computer|information tech|software|\bit\b/i, Cpu, 262],
  [/civil|construction|quantity/i, HardHat, 28],
  [/electrical|electronic|telecom/i, Zap, 48],
  [/mechanical|manufactur|industrial/i, Cog, 28],
  [/mining|earth|geolog|petroleum/i, Mountain, 24],
  [/material/i, Layers, 232],
  [/textile|clothing|apparel/i, Shirt, 320],
  [/transport|logistic/i, Truck, 215],
  [/architect|planning|building/i, Ruler, 38],
  [/geograph|geomatic|survey/i, Globe2, 168],
  [/history|heritage|archaeolog/i, Landmark, 18],
  [/archaeolog/i, Pickaxe, 18],
  [/\blaw\b/i, Gavel, 230],
  [/philosoph/i, Lightbulb, 48],
  [/political|governance/i, Vote, 232],
  [/econom/i, TrendingUp, 168],
  [/sociolog|social|anthropolog/i, Users, 320],
  [/educat/i, GraduationCap, 200],
  [/english|sinhala|tamil|language|linguist|classical|pali|buddhist|literature|translation/i, Languages, 18],
  [/fine art|music|dance|drama|art\b/i, Music, 18],
  [/management|marketing|finance|accounting|business|entrepreneur|human resource/i, Briefcase, 215],
  [/water|marine|fisher|aquatic/i, Droplets, 200],
  [/environment|climate|energy/i, Thermometer, 142],
  [/data|analytic|calculat/i, Calculator, 232],
];

function pick(table: Entry[], name: string, fallback: Entry): { Icon: LucideIcon; hue: number } {
  const [, Icon, hue] = table.find(([re]) => re.test(name)) ?? fallback;
  return { Icon, hue };
}
export const facultyIcon = (name: string) => pick(FACULTIES, name, [/./, BookOpen, 232]);
export const departmentIcon = (name: string) => pick(DEPARTMENTS, name, [/./, Building2, 232]);

/** Icon tile shown at the right of faculty and department cards. */
export function UnitIcon({ name, kind }: { name: string; kind: "faculty" | "department" }) {
  const { Icon, hue } = kind === "faculty" ? facultyIcon(name) : departmentIcon(name);
  return (
    <span className="unit-icon" style={{ "--hue": hue } as React.CSSProperties} aria-hidden="true">
      <Icon size={22} />
    </span>
  );
}
