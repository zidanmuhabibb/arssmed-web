import { getTranslations } from "next-intl/server";
import { ArrowRight, BookMarked, ClipboardList, Compass, UserRound } from "lucide-react";
import { OrbitStage } from "@/components/home/OrbitStage";
import { LinkButton } from "@/components/ui/Button";
import { ListGroup, ListRow } from "@/components/ui/ListGroup";
import type { PlanetKey } from "@/lib/design/tokens";

const PLANET_MESSAGE_KEY: Record<PlanetKey, string> = {
  matahari: "sun",
  merkurius: "mercury",
  venus: "venus",
  bumi: "earth",
  mars: "mars",
  jupiter: "jupiter",
  saturnus: "saturn",
  uranus: "uranus",
  neptunus: "neptune",
};

// Status tes kelas baru tersedia di M6 (FR-30). Sampai saat itu tombol tes tidak tampil.
const TEST_OPEN = false;

export default async function BerandaPage() {
  const t = await getTranslations();
  const names = Object.fromEntries(
    Object.entries(PLANET_MESSAGE_KEY).map(([k, msg]) => [k, t(`planets.${msg}`)]),
  ) as Record<PlanetKey, string>;

  const rowIcon = "size-6 text-tinta";

  return (
    <div className="flex flex-col gap-8 lg:gap-12">
      <section className="grid items-center gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:gap-10">
        <div className="lg:order-2">
          <OrbitStage label={t("home.stageLabel")} scaleNote={t("home.scaleNote")} names={names} />
        </div>
        <div className="flex flex-col gap-5 lg:order-1">
          <div>
            <h1 className="text-[2.15rem] font-extrabold tracking-[-0.01em] sm:text-[2.75rem] lg:text-[3.1rem]">
              {t("home.greeting")}
            </h1>
            <p className="mt-3 max-w-[60ch] text-tinta-2">{t("home.lead")}</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <LinkButton href="/belajar" icon={<ArrowRight aria-hidden="true" className="size-5" />}>
              {t("home.start")}
            </LinkButton>
            {TEST_OPEN ? (
              <LinkButton href="/tes" variant="kedua" icon={<ClipboardList aria-hidden="true" className="size-5" />}>
                {t("home.takeTest")}
              </LinkButton>
            ) : null}
          </div>
        </div>
      </section>

      <ListGroup label={t("home.moreTitle")}>
        <ListRow href="/panduan" title={t("home.guide")} hint={t("home.guideHint")} leading={<Compass aria-hidden="true" className={rowIcon} />} />
        <ListRow href="/materi" title={t("home.materi")} hint={t("home.materiHint")} leading={<BookMarked aria-hidden="true" className={rowIcon} />} />
        <ListRow href="/pembuat" title={t("home.creator")} hint={t("home.creatorHint")} leading={<UserRound aria-hidden="true" className={rowIcon} />} />
      </ListGroup>
    </div>
  );
}
