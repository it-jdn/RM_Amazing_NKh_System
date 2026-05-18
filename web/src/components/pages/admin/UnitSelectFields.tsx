"use client";

import { useLocale } from "@/context/LocaleContext";
import { unitDisplayName } from "@/lib/i18n/unit-display-name";
import type { UnitOption, UnitPairHint } from "@/lib/types";

export function UnitSelectFields(props: {
  mainUnits: UnitOption[];
  subUnits: UnitOption[];
  pairHints: UnitPairHint[];
  aMain: string;
  setAMain: (code: string) => void;
  aSub: string;
  setASub: (code: string) => void;
  aConv: string;
  setAConv: (v: string) => void;
  labels: { mainUnit: string; subUnit: string; convert: string; select: string };
}) {
  const { locale } = useLocale();
  const subSorted = [...props.subUnits].sort((a, b) => {
    const hintOrder = (code: string) => {
      const h = props.pairHints.find((p) => p.subUnitCode === code);
      return h ? -h.useCount : 0;
    };
    return hintOrder(b.unitCode) - hintOrder(a.unitCode) || b.usageCountSub - a.usageCountSub;
  });

  function onMainChange(code: string) {
    props.setAMain(code);
    const best = props.pairHints.find((p) => p.mainUnitCode === code);
    if (best) {
      props.setASub(best.subUnitCode);
      props.setAConv(String(best.convertRate));
    }
  }

  return (
    <div className="form-row c3">
      <div>
        <label className="lbl">{props.labels.mainUnit}</label>
        <select value={props.aMain} onChange={(e) => onMainChange(e.target.value)}>
          <option value="">{props.labels.select}</option>
          {props.mainUnits.map((u) => (
            <option key={u.unitCode} value={u.unitCode}>
              {unitDisplayName(u, locale)}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="lbl">{props.labels.subUnit}</label>
        <select value={props.aSub} onChange={(e) => props.setASub(e.target.value)}>
          <option value="">{props.labels.select}</option>
          {subSorted.map((u) => (
            <option key={u.unitCode} value={u.unitCode}>
              {unitDisplayName(u, locale)}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="lbl">{props.labels.convert}</label>
        <input type="number" value={props.aConv} onChange={(e) => props.setAConv(e.target.value)} />
      </div>
    </div>
  );
}
