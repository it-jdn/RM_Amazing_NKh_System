import type { Locale } from "@/lib/i18n/types";
import type { Supplier, UnitOption, UnitPairHint } from "@/lib/types";
import { supplierDisplayName } from "@/lib/i18n/supplier-name";
import { UnitSelectFields } from "@/components/pages/admin/UnitSelectFields";

export function AdminCardTitle({
  title,
  dot = "green",
}: {
  title: string;
  dot?: "green" | "orange" | "blue" | "purple";
}) {
  return (
    <div className="card-title">
      <span className={`dot dot-${dot}`} />
      <span>{title}</span>
    </div>
  );
}

export function MiName({ name }: { name: string }) {
  return <div className="mi-name">{name}</div>;
}

export function AdminItemForm(props: {
  suppliers: Supplier[];
  locale: Locale;
  aSupp: string;
  setASupp: (v: string) => void;
  aNameTH: string;
  setANameTH: (v: string) => void;
  aNameEN: string;
  setANameEN: (v: string) => void;
  aNameKR: string;
  setANameKR: (v: string) => void;
  aMain: string;
  setAMain: (v: string) => void;
  aSub: string;
  setASub: (v: string) => void;
  aConv: string;
  setAConv: (v: string) => void;
  aPrice: string;
  setAPrice: (v: string) => void;
  mainUnits?: UnitOption[];
  subUnits?: UnitOption[];
  pairHints?: UnitPairHint[];
  onAdd: () => void;
  labels: {
    shop: string;
    nameTh: string;
    nameEn: string;
    nameKr: string;
    mainUnit: string;
    subUnit: string;
    convert: string;
    unitPrice: string;
    submit: string;
    select: string;
  };
}) {
  return (
    <>
      <div className="form-row">
        <div>
          <label className="lbl">{props.labels.shop}</label>
          <select value={props.aSupp} onChange={(e) => props.setASupp(e.target.value)}>
            <option value="">{props.labels.select}</option>
            {props.suppliers.map((s) => (
              <option key={s.code} value={s.code}>
                {supplierDisplayName(s, props.locale)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="lbl">{props.labels.nameTh}</label>
          <input value={props.aNameTH} onChange={(e) => props.setANameTH(e.target.value)} />
        </div>
      </div>
      <div className="form-row c2">
        <div>
          <label className="lbl">{props.labels.nameEn}</label>
          <input value={props.aNameEN} onChange={(e) => props.setANameEN(e.target.value)} />
        </div>
        <div>
          <label className="lbl">{props.labels.nameKr}</label>
          <input value={props.aNameKR} onChange={(e) => props.setANameKR(e.target.value)} />
        </div>
      </div>
      {props.mainUnits && props.subUnits ? (
        <UnitSelectFields
          mainUnits={props.mainUnits}
          subUnits={props.subUnits}
          pairHints={props.pairHints || []}
          aMain={props.aMain}
          setAMain={props.setAMain}
          aSub={props.aSub}
          setASub={props.setASub}
          aConv={props.aConv}
          setAConv={props.setAConv}
          labels={{
            mainUnit: props.labels.mainUnit,
            subUnit: props.labels.subUnit,
            convert: props.labels.convert,
            select: props.labels.select,
          }}
        />
      ) : (
        <div className="form-row c3">
          <div>
            <label className="lbl">{props.labels.mainUnit}</label>
            <input value={props.aMain} onChange={(e) => props.setAMain(e.target.value)} />
          </div>
          <div>
            <label className="lbl">{props.labels.subUnit}</label>
            <input value={props.aSub} onChange={(e) => props.setASub(e.target.value)} />
          </div>
          <div>
            <label className="lbl">{props.labels.convert}</label>
            <input type="number" value={props.aConv} onChange={(e) => props.setAConv(e.target.value)} />
          </div>
        </div>
      )}
      <div className="form-row c2">
        <div>
          <label className="lbl">{props.labels.unitPrice}</label>
          <input type="number" value={props.aPrice} onChange={(e) => props.setAPrice(e.target.value)} />
        </div>
      </div>
      <button type="button" className="btn btn-primary" onClick={props.onAdd}>
        {props.labels.submit}
      </button>
    </>
  );
}
