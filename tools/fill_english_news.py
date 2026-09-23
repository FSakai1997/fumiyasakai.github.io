"""2026年のニュース記事の英訳を data/news.json へ入れる（一度きり）。

日付で記事を特定し、日本語のタイトルと照合してから書き込む。
一致しなければ、誤った記事を上書きせずに失敗する。
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# 日付 -> {title, body, citations: [本文の英訳, ...]}
# citations は元の並び順。空文字列はその引用に英訳が要らないことを表す。
ARTICLES = {
    "2026-09-16": {
        "ja_title": "共著論文がGPLで出版されました",
        "title": "A co-authored paper has been published in GPL",
        "body": (
            "<p>A paper co-authored with Jun Takeshita, a junior colleague in my former "
            "laboratory, has been published in <i>Geochemical Perspectives Letters</i>.</p>\n"
            "<p>Iron and hydrogen had been thought to barely react at ambient pressure, with "
            "FeH compounds forming only above about 3 GPa. On that basis, the melting "
            "temperature of the Fe-H system was expected to drop sharply within the narrow "
            "range of 2-3 GPa. Experiments below 2 GPa, however, had hardly been carried out, "
            "and this sharp drop had never been confirmed. We therefore performed melting "
            "experiments on the Fe-H system at the relatively modest pressures of a few GPa, "
            "using anvils with an unusually large culet diameter of 800 &mu;m for a diamond "
            "anvil cell, and tracked how the melting temperature actually changes. The "
            "experiments show that iron and hydrogen in fact begin to react at lower "
            "pressures and do so gradually, giving a more continuous change than previously "
            "assumed.</p>\n"
            "<p>This means that the reaction between iron and hydrogen starts at lower "
            "pressures than earlier estimates suggested. Small bodies such as the Moon have "
            "been assumed to incorporate almost no hydrogen into their cores, because the low "
            "pressure of core separation implies a very low solubility of hydrogen in iron. "
            "If hydrogen dissolves into iron from low pressures, as our results indicate, "
            "the hydrogen content of the cores of small bodies such as the Moon needs to be "
            "reconsidered.</p>"
        ),
        "citations": [""],
    },
    "2026-09-15": {
        "ja_title": "SP長期課題の解説記事が出版されました",
        "title": "An article on my SPring-8 long-term project has been published",
        "body": (
            "<p>An article describing the results of the graduate student proposal "
            "(long-term type) that I carried out at SPring-8 BL10XU for about two and a half "
            "years, through the last fiscal year, has been published in "
            "<i>SPring-8/SACLA/NanoTerasu Users Information</i>.</p>\n"
            "<p>Recent missions to Mars have begun to provide direct observational "
            "constraints on its interior, yet determining the deep structure from such "
            "limited data remains difficult. Adding material-science constraints from "
            "high-pressure experiments is an essential way to give interior models a "
            "physical and chemical basis. On the materials side, however, high-pressure "
            "experiments in the temperature, pressure and composition range relevant to the "
            "Martian core have been scarce. In this work I determined the density of liquid "
            "FeS and the liquidus phase relations of the Fe-FeS system by in situ X-ray "
            "diffraction at high pressure and temperature. The results show that explaining "
            "the observed density of the Martian core requires at least 17 wt% sulfur, and "
            "that under those conditions the solid phase Fe12S7, which is richer in sulfur "
            "than the liquid core, can crystallize as an inner core at the center of Mars. "
            "The growth of such a sulfur-rich inner core would suppress the compositional "
            "convection that drives a dynamo, which may explain why Mars has no global "
            "magnetic field today.</p>\n"
            "<p>Please see the original papers below for details. This work also received "
            "the SPring-8 Excellent Research Award for Graduate Student Proposals.</p>"
        ),
        "citations": [
            "<strong>Sakai, F.</strong>, Revealing the structure of the Martian core by in situ "
            "high-pressure X-ray diffraction experiments, "
            "<i>SPring-8/SACLA/NanoTerasu Users Information</i>, 2(3), 136-141, 2026. (in Japanese)"
        ],
    },
    "2026-06-22": {
        "ja_title": "主著論文がJGR:Planetsで出版されました",
        "title": "A first-author paper has been published in JGR: Planets",
        "body": (
            "<p>A first-author paper has been published in "
            "<i>Journal of Geophysical Research: Planets</i>.</p>\n"
            "<p>Recent exploration of Mars by InSight has shown that the density of the "
            "Martian core is lower than would be expected for pure iron. The elements "
            "responsible for this deficit are called light elements, and sulfur is regarded "
            "as the leading candidate for the Martian core.</p>\n"
            "<p>How much sulfur the Martian core actually contains, however, is still not well "
            "constrained. Earlier estimates relied mainly on experiments at lower pressures "
            "and on theoretical calculations, and uncertainty remained because the magnetic "
            "properties of iron must be treated properly at Martian core conditions. "
            "Experiments at the actual pressure and temperature of the Martian core were "
            "therefore needed.</p>\n"
            "<p>In this study we measured the density of liquid FeS under Martian core "
            "conditions using a laser-heated diamond anvil cell combined with synchrotron "
            "X-ray diffraction. The results show that the equation of state for liquid FeS "
            "used until now underestimates the density.</p>\n"
            "<p>Using the new equation of state, we then estimated the sulfur content of the "
            "Martian core. For a hot core consistent with the presence of a molten silicate "
            "layer (MSL), at least 17 wt% sulfur is required.</p>"
        ),
        "citations": [""],
    },
    "2026-06-17": {
        "ja_title": "SPring-8大学院生課題優秀研究賞を受賞しました。",
        "title": "Received the SPring-8 Excellent Research Award for Graduate Student Proposals",
        "body": (
            "<p>I received the SPring-8 Excellent Research Award for Graduate Student "
            "Proposals.<br>\nThe award recognizes work carried out under the graduate student "
            "proposal (long-term type) programme, which ran through the last fiscal year.\n"
            "<br>\n<br>\nFrom October 2023 to February 2025 I used BL10XU, the high-pressure "
            "X-ray diffraction beamline, to study the composition and structure of the Martian "
            "core. The main results were measurements of the density of liquid FeS and the "
            "determination of the phase diagram of the Fe-FeS system, from which I estimated "
            "the sulfur content of the Martian core. These results indicate that an inner core "
            "made of Fe12S7 may have formed at the center of Mars.<br>\n<br>\nIf such a "
            "light-element-rich inner core forms, the liquid at the base of the outer core "
            "becomes denser than its surroundings as the inner core grows, which suggests that "
            "core convection is suppressed rather than driven, in contrast to the Earth. This "
            "is consistent with the absence of a global magnetic field on Mars today.<br>\n"
            "<br>\nI am grateful to everyone involved for recognizing this work.\n</p>"
        ),
        "citations": ["", ""],
    },
    "2026-05-27": {
        "ja_title": "JpGU-AGU joint meeting 2026で口頭発表を行いました",
        "title": "Gave an oral presentation at JpGU-AGU Joint Meeting 2026",
        "body": (
            "<p>I attended the JpGU-AGU Joint Meeting 2026, held in Chiba from 24 to 30 May "
            "2026, and gave an oral presentation. I presented molecular dynamics simulations "
            "of the Fe-Si-O system using a machine-learning potential (MLMD), work I carried "
            "out during my stay at IPGP. This was my first project on the theoretical side, "
            "and I was relieved to have brought it far enough to present. With the recent "
            "progress in machine learning, MLMD has come to occupy a prominent place in deep "
            "Earth science. At the same time, unphysical results can go unnoticed, so the "
            "approach calls for care. Working with the method myself taught me a great "
            "deal.</p>"
        ),
        "citations": [],
    },
    "2026-04-13": {
        "ja_title": "共著論文がGCAで出版されました",
        "title": "A co-authored paper has been published in GCA",
        "body": (
            "<p>A co-authored paper has been published in "
            "<i>Geochimica et Cosmochimica Acta</i>. It is joint work with Kenji Ozawa, a "
            "senior colleague in my former laboratory and now an assistant professor at the "
            "University of Hyogo, and others.</p>\n"
            "<p>Using X-ray absorption spectroscopy (XAFS) and X-ray emission spectroscopy "
            "(XES) at SPring-8 and KEK, the study documents how the bond lengths and "
            "coordination numbers of Mn2+, Co2+, Ni2+ and Mo6+ in silicate glasses change "
            "under high pressure. These local changes are thought to affect the partitioning "
            "of elements between minerals and silicate melts, and between metal and silicate "
            "melts, in the deep Earth, as well as isotopic fractionation.</p>\n"
            "<p>My contribution was to carry out the XAFS and XES measurements at SPring-8 "
            "BL39XU and BL12XU together with Dr. Ozawa.</p>"
        ),
        "citations": [""],
    },
    "2026-04-01": {
        "ja_title": "東京科学大学・太田研究室に学振PDとして着任しました",
        "title": "Joined the Ohta Laboratory at Institute of Science Tokyo as a JSPS Research Fellow (PD)",
        "body": (
            "<p>I have taken up a position as a JSPS Research Fellow (PD) in the Ohta "
            "Laboratory, Department of Earth and Planetary Sciences, School of Science, "
            "Institute of Science Tokyo.</p>\n"
            "<p>The laboratory is well known for measurements of physical properties under "
            "high pressure, and I look forward to learning a range of new techniques "
            "here.</p>\n"
            "<p>I am grateful to everyone in the Ohta Laboratory for welcoming me.</p>"
        ),
        "citations": [],
    },
    "2026-03-24": {
        "ja_title": "東京大学 理学系研究科博士課程を修了しました",
        "title": "Completed my doctoral programme at the Graduate School of Science, The University of Tokyo",
        "body": (
            "<p>I have completed the doctoral programme at the Graduate School of Science, "
            "The University of Tokyo.\n<br>\n<br>\nLooking back, I spent nine of my student "
            "years at the University of Tokyo, about six of them doing research under "
            "Professor Hirose. It has been the most rewarding period of my life so far. "
            "Building on the techniques and knowledge I gained in the Hirose Laboratory, "
            "I hope to keep pursuing new questions and to contribute to the advancement of "
            "Earth science.\n<br>\n<br>\nI am deeply grateful to my family and friends, who "
            "encouraged me to pursue a doctorate, and to Professor Hirose and everyone in the "
            "laboratory for their long-standing guidance.</p>"
        ),
        "citations": [],
    },
    "2026-03-10": {
        "ja_title": "東京大学 理学系研究科研究奨励賞(博士)を受賞しました",
        "title": "Received the Research Encouragement Award (Doctoral), Graduate School of Science, The University of Tokyo",
        "body": (
            "<p>My doctoral research received the Research Encouragement Award (Doctoral) from "
            "the Graduate School of Science. Using the diamond anvil cell, I constrained the "
            "core compositions of the Earth and Mars, and discussed how the light-element "
            "composition may have strongly influenced the magnetic evolution of each "
            "planet.</p>\n"
            "<p>I thank the faculty of the Department of Earth and Planetary Science for "
            "nominating me, and in particular my supervisor, Professor Hirose.</p>"
        ),
        "citations": [""],
    },
    "2026-03-04": {
        "ja_title": "第12回PRIUSシンポジウムで発表しました",
        "title": "Presented at the 12th PRIUS Symposium",
        "body": (
            "<p>I attended the 12th Symposium of the Ehime University Research Center for "
            "Advanced Ultrahigh-Pressure Science (PRIUS), held at the Geodynamics Research "
            "Center, Ehime University.</p>\n"
            "<p>I also presented my recent work on the Martian core, under the title "
            "\"Estimating the compositions of the Martian outer and inner core from X-ray "
            "diffraction measurements\".</p>"
        ),
        "citations": [],
    },
}


def main() -> int:
    path = ROOT / "data" / "news.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    by_date = {}
    for item in data["items"]:
        by_date.setdefault(item["date"], []).append(item)

    filled = 0
    for date, spec in ARTICLES.items():
        matches = by_date.get(date, [])
        if len(matches) != 1:
            raise SystemExit(f"{date} の記事が {len(matches)} 件見つかりました。中止します。")
        item = matches[0]
        if item["ja"]["title"] != spec["ja_title"]:
            raise SystemExit(
                f"{date} のタイトルが一致しません。\n"
                f"  期待: {spec['ja_title']}\n"
                f"  実際: {item['ja']['title']}\n中止します。"
            )

        item["en"]["title"] = spec["title"]
        item["en"]["body"] = spec["body"]

        citations = item.get("citations", [])
        expected = spec["citations"]
        if len(citations) != len(expected):
            raise SystemExit(
                f"{date} の引用が {len(citations)} 件ありますが、"
                f"英訳の指定は {len(expected)} 件です。中止します。"
            )
        for citation, english in zip(citations, expected):
            if english:
                citation["text"]["en"] = english
            elif not citation["text"]["en"]:
                # 書誌情報がもともと英語なら、そのまま英語側にも使う。
                citation["text"]["en"] = citation["text"]["ja"]

        filled += 1
        print(f"  {date}  {spec['title'][:60]}")

    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"\n{filled} 件の記事に英訳を入れました")
    return 0


if __name__ == "__main__":
    sys.exit(main())
