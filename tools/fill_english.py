"""研究紹介とCVの英訳を data/*.json の en フィールドへ入れる（一度きり）。

日本語の原文と照合してから書き込む。データの並びが変わっていた場合は、
誤った行を上書きせずに失敗する。

固有名詞は、可能な限り公式の英語名称を使った。確証のないものは
UNCERTAIN に列挙し、実行時に一覧を出す。利用者が確認して直すこと。
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# 公式の英語名称に確証がなく、利用者の確認が要るもの。
UNCERTAIN = [
    ("Grants", "日本高圧力学会 海外学生発表奨励金", "Student Travel Grant ... と訳した"),
    ("Grants", "SPring-8 大学院生提案型課題 (長期型)", "Graduate Student Research Proposal (Long-term) と訳した"),
    ("Awards", "SPring-8大学院生課題優秀研究賞", "SPring-8 Excellent Research Award ... と訳した"),
    ("Awards", "東京大学理学系研究科 研究奨励賞", "Research Encouragement Award と訳した"),
    ("Awards", "東京大学理学部 学修奨励賞", "Academic Achievement Award と訳した"),
    ("Proceedings", "SPring-8/SACLA/NanoTerasu 利用者情報", "Users Information と訳した"),
    ("Domestic", "丹羽佑果 / 大島由佳", "Niwa, Y. / Oshima, Y. とローマ字化した（読みの確認が必要）"),
    ("Outreach", "東京大学木曽観測所 星の教室", "Hoshi-no-Kyoshitsu (Star Classroom) と訳した"),
]

# --------------------------------------------------------------------------
# 研究紹介
# --------------------------------------------------------------------------

RESEARCH = [
    {
        "match": "地球コアの組成決定",
        "heading": "Determining the Composition of Earth's Core:<br>Partitioning Behavior of Light Elements",
        "caption": "Probing deep Earth materials through high-pressure experiments",
        "body": (
            "<p>Recent missions such as Hayabusa2 have made it possible to bring back samples "
            "from nearby space directly. The interior of our own planet, however, remains far "
            "less accessible. The core, which accounts for roughly 30% of the Earth, is "
            "particularly poorly understood, because no material from it is ever carried to "
            "the surface and direct sampling is therefore impossible.</p>\n"
            "<p>One of the main ways to infer the composition of the core is seismic "
            "observation. Earlier work has established that the core is less dense than pure "
            "iron, and must therefore contain <strong>\"light elements\" (Si, S, O, C, H and "
            "others)</strong>. Exactly which elements are present, and in what amounts, has "
            "been debated for decades.</p>\n"
            "<p>Since the densities of both the liquid outer core and the solid inner core "
            "have already been estimated, I aim to determine the composition of the core more "
            "precisely by constraining both at the same time. I focus in particular on how "
            "interactions among light elements alter the <strong>solid-liquid partition "
            "coefficient</strong>, the ratio in which an element is distributed between the "
            "solid and the liquid. Using ultrahigh-pressure experiments with a "
            "<strong>diamond anvil cell (DAC)</strong>, I observe how these elements behave "
            "under conditions comparable to those at the center of the Earth.</p>"
        ),
    },
    {
        "match": "火星の内部構造と進化",
        "heading": "The Interior Structure and Evolution of Mars:<br>The Puzzle of a Sulfur-Rich Core",
        "caption": "Phase diagram of the Fe-S system at the pressure of the Martian core center (Sakai and Hirose, 2026)",
        "body": (
            "<p>Marsquake observations by NASA's InSight lander have provided direct estimates "
            "of the radius and density of the Martian core. The core turned out to be larger, "
            "and less dense, than previously expected. Accounting for that low density "
            "requires a substantial amount of light elements in addition to iron, with "
            "<strong>sulfur (S)</strong> as the leading candidate.</p>\n"
            "<p>The depletion of chalcophile elements at the Martian surface, together with "
            "analyses of Martian meteorites, likewise points to a core rich in sulfur. "
            "High-pressure experimental data on the Fe-S system under such sulfur-rich "
            "conditions have been scarce, however, and even the melting (liquidus) phase "
            "diagram at Martian core pressures had not been established.</p>\n"
            "<p>I am therefore reconstructing the interior structure and thermal history of "
            "Mars through high-pressure experiments on the Fe-S system. Building on "
            "experimental data, I propose new models addressing questions such as which solid "
            "composition crystallizes from the liquid core, and whether Mars has an inner core "
            "at all. I am currently investigating the possibility that a phase called "
            "<strong>Fe<sub>12</sub>S<sub>7</sub></strong> forms that inner core.</p>"
        ),
    },
]

# --------------------------------------------------------------------------
# CV
# --------------------------------------------------------------------------

PROFILE_NAME = "Fumiya Sakai"
PROFILE_LINES = [
    "Department of Earth and Planetary Sciences, School of Science, Institute of Science Tokyo",
    "Ohta Laboratory, JSPS Research Fellow (PD)",
    "Email: fumiya.sakai1997[at]gmail.com",
]

# (セクション見出し, [(日本語の一部, 英訳), ...])
CV = [
    ("Grants & Scholarships", [
        ("特別研究員 (PD)",
         "JSPS Research Fellowship for Young Scientists (PD), Japan Society for the Promotion of Science"),
        ("Graduate Research Abroad in Science Program",
         "Graduate Research Abroad in Science Program (GRASP), The University of Tokyo"),
        ("海外学生発表奨励金",
         "Student Travel Grant for Presentations Abroad, The Japan Society of High Pressure Science and Technology"),
        ("大学院生提案型課題",
         "Principal Investigator, SPring-8 Graduate Student Research Proposal (Long-term)"),
        ("特別研究員 (DC1)",
         "JSPS Research Fellowship for Young Scientists (DC1), Japan Society for the Promotion of Science"),
        ("宇宙地球科学フロンティア卓越大学院プログラム",
         "International Graduate Program for Excellence in Earth-Space Science (IGPEES), The University of Tokyo"),
    ]),
    ("Awards", [
        ("SPring-8大学院生課題優秀研究賞",
         "SPring-8 Excellent Research Award for Graduate Student Proposals, Japan Synchrotron Radiation Research Institute (JASRI)"),
        ("研究奨励賞 (博士)",
         "Research Encouragement Award (Doctoral), Graduate School of Science, The University of Tokyo"),
        ("FE優秀賞",
         "Excellence Award for the Final Examination (FE), International Graduate Program for Excellence in Earth-Space Science (IGPEES), The University of Tokyo"),
        ("JpGU2025) 学生優秀発表賞",
         "Outstanding Student Presentation Award (OSPA), Japan Geoscience Union Meeting 2025 (JpGU2025)"),
        ("JpGU2024) 学生優秀発表賞",
         "Outstanding Student Presentation Award (OSPA), Japan Geoscience Union Meeting 2024 (JpGU2024)"),
        ("研究奨励賞 (修士)",
         "Research Encouragement Award (Master's), Graduate School of Science, The University of Tokyo"),
        ("QE優秀賞",
         "Excellence Award for the Qualifying Examination (QE), International Graduate Program for Excellence in Earth-Space Science (IGPEES), The University of Tokyo"),
        ("JpGU2021) 学生優秀発表賞",
         "Outstanding Student Presentation Award (OSPA), Japan Geoscience Union Meeting 2021 (JpGU2021)"),
        ("学修奨励賞",
         "Academic Achievement Award, Faculty of Science, The University of Tokyo"),
    ]),
    ("Proceedings / unreviewed paper", [
        ("高圧その場 X 線回折実験による火星コアの構造解明",
         '<strong>Sakai, F.</strong>, Revealing the structure of the Martian core by in situ '
         'high-pressure X-ray diffraction experiments, '
         '<i>SPring-8/SACLA/NanoTerasu Users Information</i>, 2(3), 136-141, 2026. (in Japanese) '
         '<a href="https://ssn-info.jasri.jp/volume-02-no3/1602/" target="_blank">[Link]</a>'),
    ]),
    ("Domestic Conference Presentations (1st Author)", [
        ("火星の外核・内核の組成推定",
         "<strong>Sakai, F.</strong>, Estimating the compositions of the Martian outer and inner core "
         "from X-ray diffraction measurements, 12th PRIUS Symposium, Japan, (Matsuyama, 2026.03.02). "
         "Oral Presentation (in Japanese)"),
        ("液体FeSの密度決定",
         "<strong>Sakai, F.</strong>, Density determination of liquid FeS under Martian core conditions "
         "by X-ray diffraction measurements, SPRUC Symposium 2025, Japan, (Miyagi, 2025.09.05). "
         "Poster (in Japanese)"),
        ("Fe-FeS状態図の決定",
         "<strong>Sakai, F.</strong>, Determination of the Fe-FeS phase diagram under Martian core "
         "pressures: the possibility of an Fe12S7 inner core, SPring-8 Symposium 2024, Japan, "
         "(Fukuoka, 2024.09.05). Poster (in Japanese)"),
        ("Fe3S2 組成のコア圧力下",
         "<strong>Sakai, F.</strong>, Hirose, K., In situ XRD measurements of Fe3S2 under core pressures "
         "and determination of the equation of state of Fe12S7, 63rd High Pressure Conference of Japan, "
         "Japan, (Osaka, 2022.12.13). Poster (in Japanese)"),
        ("銀河学校」のオンライン実施報告",
         "<strong>Sakai, F.</strong>, Niwa, Y., Oshima, Y., Miyata, T., Yoshii, Y., Ohsawa, R., "
         "Takahashi, H., Mori, Y., other Galaxy School 2020 staff, Science Station, "
         "Report on the online edition of Galaxy School, an astronomy research program for high school "
         "students, Astronomical Society of Japan 2021 Spring Annual Meeting, (Online, 2021.03.17). "
         "Y03a, Oral Presentation (in Japanese)"),
    ]),
    ("Conference Presentations (co-author)", [
        ("メタンの高温高圧での相転移",
         "Takeshita, J., Hikosaka, K., <strong>Sakai, F.</strong>, Hirose, K., "
         "Phase transitions and liquid density of methane at high pressure and temperature, "
         "65th High Pressure Conference of Japan, Japan, (Iwate, 2024.11.13). Poster (in Japanese)"),
        ("銀河学校 2021」オンライン実施報告",
         "Oshima, Y., <strong>Sakai, F.</strong>, Miyata, T., Yoshii, Y., Takahashi, H., Niino, Y., "
         "Mori, Y., other Galaxy School 2021 staff, Science Station, "
         "Report on the online edition of Galaxy School 2021, an astronomy research program for high "
         "school students, Astronomical Society of Japan 2022 Spring Annual Meeting, "
         "(Online, 2022.03.03). Y02a, Oral Presentation (in Japanese)"),
    ]),
    ("Lectures", [
        ("非常勤講師",
         "Part-time Lecturer, Department of Earth and Planetary Physics, Faculty of Science, "
         "The University of Tokyo: laboratory courses in Earth and Planetary Physics and "
         "Earth and Planetary Chemistry"),
        ("オープンキャンパス2022",
         '"The Core of the Earth: Looking into the Deep Interior through High-Pressure Experiments", '
         'live lecture at Open Campus 2022, Faculty of Science, The University of Tokyo '
         '<a href="https://www.youtube.com/watch?v=4LzvgWiZ6rw&t=1s" target="_blank">[Video]</a>'),
        ("自然現象とモデル化",
         '"Natural Phenomena and Modeling", guest lecture at Matsue Kita High School, Shimane'),
    ]),
    ("Outreach Activities", [
        ("定例観望会スタッフ",
         "Staff, Public Stargazing Program, National Astronomical Observatory of Japan"),
        ("日本地学オリンピック本選チューター",
         "Tutor, Final Round of the Japan Earth Science Olympiad, "
         "NPO Japan Committee of the Earth Science Olympiad"),
        ("銀河学校 ティーチングアシスタント",
         "Teaching Assistant, Galaxy School, NPO Science Station"),
        ("サイエンスカフェ in 松江",
         "Science Cafe in Matsue, co-hosted by NPO Science Station and Matsue Kita High School, Shimane"),
        ("島根県立松江北高等学校 出張授業",
         "Guest lectures at Matsue Kita High School, Shimane"),
        ("星の教室 ティーチングアシスタント",
         "Teaching Assistant, Hoshi-no-Kyoshitsu (Star Classroom), Kiso Observatory, "
         "The University of Tokyo"),
    ]),
    ("Others", [
        ("高等学校教諭一種免許状",
         "Type 1 Teaching License for Upper Secondary School (Science), Japan"),
        ("気象予報士",
         "Certified Weather Forecaster (national qualification, Japan)"),
    ]),
]


def fill_research() -> int:
    path = ROOT / "data" / "research.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    filled = 0

    for spec in RESEARCH:
        matches = [t for t in data["topics"] if spec["match"] in t["heading"]["ja"]]
        if len(matches) != 1:
            raise SystemExit(f"研究テーマ {spec['match']!r} が {len(matches)} 件見つかりました。中止します。")
        topic = matches[0]
        topic["heading"]["en"] = spec["heading"]
        topic["body"]["en"] = spec["body"]
        if topic.get("image"):
            topic["image"]["caption"]["en"] = spec["caption"]
        filled += 1
        print(f"  研究テーマ: {spec['match']}")

    path.write_text(
        json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    return filled


def fill_cv() -> int:
    path = ROOT / "data" / "cv.json"
    data = json.loads(path.read_text(encoding="utf-8"))

    data["profile"]["en"] = {"name": PROFILE_NAME, "lines": list(PROFILE_LINES)}
    print("  Profile")

    filled = 1
    sections = {s["heading"]: s for s in data["sections"]}

    for heading, pairs in CV:
        if heading not in sections:
            raise SystemExit(f"セクション {heading!r} が見つかりません。中止します。")
        entries = sections[heading]["entries"]
        for needle, english in pairs:
            matches = [e for e in entries if needle in e["ja"]]
            if len(matches) != 1:
                raise SystemExit(
                    f"{heading} の {needle!r} が {len(matches)} 件見つかりました。中止します。"
                )
            matches[0]["en"] = english
            filled += 1
        print(f"  {heading}: {len(pairs)} 項目")

    path.write_text(
        json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    return filled


def main() -> int:
    print("研究紹介:")
    research_count = fill_research()
    print("\nCV:")
    cv_count = fill_cv()

    print(f"\n英訳を入れました: 研究テーマ {research_count} 件 / CV {cv_count} 項目")
    print("\n公式の英語名称に確証がなく、確認が必要なもの:")
    for area, item, note in UNCERTAIN:
        print(f"  [{area}] {item} — {note}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
