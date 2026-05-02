"""PDF report generation.

Produces a polished, audit-friendly PDF using reportlab's Platypus flowables.
The output is intentionally focused — auditors care about *what failed*, *on
which target*, *with what evidence*, and *what to do about it*. We give them
that first; supporting tables (passes, devices, rules) come after.
"""

from __future__ import annotations

import io
from datetime import datetime, timezone

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    BaseDocTemplate, Frame, KeepTogether, PageBreak, PageTemplate,
    Paragraph, Spacer, Table, TableStyle,
)

from app.models import BenchmarkResult, Device, FirewallRuleSet, ScanSummary

# Brand colours — kept in sync with the dashboard palette.
DEEPSKY = colors.Color(4 / 255, 170 / 255, 218 / 255)
STEELBLUE = colors.Color(4 / 255, 118 / 255, 172 / 255)
SKYBLUE = colors.Color(104 / 255, 216 / 255, 240 / 255)
ALICE = colors.Color(238 / 255, 246 / 255, 252 / 255)
INK = colors.Color(19 / 255, 35 / 255, 44 / 255)
MUTED = colors.Color(97 / 255, 101 / 255, 102 / 255)
SUCCESS = colors.Color(5 / 255, 150 / 255, 105 / 255)
DANGER = colors.Color(220 / 255, 38 / 255, 38 / 255)
WARNING = colors.Color(217 / 255, 119 / 255, 6 / 255)


def _styles() -> dict[str, ParagraphStyle]:
    base = getSampleStyleSheet()
    return {
        "h1": ParagraphStyle(
            "h1", parent=base["Heading1"], fontSize=22, leading=26,
            textColor=INK, spaceAfter=4, fontName="Helvetica-Bold",
        ),
        "h2": ParagraphStyle(
            "h2", parent=base["Heading2"], fontSize=14, leading=18,
            textColor=STEELBLUE, spaceBefore=14, spaceAfter=6, fontName="Helvetica-Bold",
        ),
        "h3": ParagraphStyle(
            "h3", parent=base["Heading3"], fontSize=11, leading=14,
            textColor=INK, spaceBefore=8, spaceAfter=2, fontName="Helvetica-Bold",
        ),
        "body": ParagraphStyle(
            "body", parent=base["BodyText"], fontSize=9.5, leading=13,
            textColor=INK, spaceAfter=4,
        ),
        "muted": ParagraphStyle(
            "muted", parent=base["BodyText"], fontSize=8.5, leading=11,
            textColor=MUTED, spaceAfter=2,
        ),
        "evidence": ParagraphStyle(
            "evidence", parent=base["Code"], fontSize=8, leading=11,
            textColor=INK, leftIndent=8, fontName="Courier", spaceAfter=2,
        ),
        "remediation": ParagraphStyle(
            "remediation", parent=base["BodyText"], fontSize=9, leading=12,
            textColor=STEELBLUE, leftIndent=8, spaceAfter=2,
        ),
        "label": ParagraphStyle(
            "label", parent=base["BodyText"], fontSize=7.5, leading=10,
            textColor=MUTED, fontName="Helvetica-Bold", spaceAfter=1,
        ),
    }


class _BrandedDoc(BaseDocTemplate):
    """Adds a header bar + footer with page numbers to every page."""

    def __init__(self, buf: io.BytesIO, scan: ScanSummary):
        super().__init__(buf, pagesize=A4, leftMargin=18 * mm, rightMargin=18 * mm,
                         topMargin=28 * mm, bottomMargin=18 * mm,
                         title="Network Posture Scanner — Report",
                         author="Network Posture Scanner")
        self.scan = scan
        frame = Frame(self.leftMargin, self.bottomMargin,
                      self.width, self.height, id="content")
        self.addPageTemplates([PageTemplate(id="branded", frames=frame, onPage=self._draw_chrome)])

    def _draw_chrome(self, canvas, doc):  # noqa: N802 — reportlab signature
        canvas.saveState()
        # Top brand bar
        canvas.setFillColor(STEELBLUE)
        canvas.rect(0, A4[1] - 16 * mm, A4[0], 16 * mm, stroke=0, fill=1)
        canvas.setFillColor(SKYBLUE)
        canvas.rect(0, A4[1] - 16 * mm, A4[0], 1.5 * mm, stroke=0, fill=1)

        canvas.setFillColor(ALICE)
        canvas.setFont("Helvetica-Bold", 11)
        canvas.drawString(18 * mm, A4[1] - 10 * mm, "Network Posture Scanner")
        canvas.setFont("Helvetica", 8.5)
        canvas.drawRightString(
            A4[0] - 18 * mm,
            A4[1] - 10 * mm,
            f"Report · scan {self.scan.scan_id[:12]} · "
            f"{self.scan.started_at.astimezone(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}",
        )

        # Footer
        canvas.setFillColor(MUTED)
        canvas.setFont("Helvetica", 8)
        canvas.drawString(18 * mm, 10 * mm, "Confidential · for the recipient's use only")
        canvas.drawRightString(A4[0] - 18 * mm, 10 * mm, f"Page {doc.page}")
        canvas.restoreState()


def render_pdf(
    *,
    scan: ScanSummary,
    devices: list[Device],
    rulesets: list[FirewallRuleSet],
    results: list[BenchmarkResult],
) -> bytes:
    """Build the PDF and return its bytes."""
    buf = io.BytesIO()
    doc = _BrandedDoc(buf, scan)
    s = _styles()
    story: list = []

    # ── Cover / executive summary ────────────────────────────────────────────
    story.append(Paragraph("Network posture report", s["h1"]))
    story.append(Paragraph(
        f"Generated {datetime.now(timezone.utc).strftime('%d %B %Y, %H:%M UTC')} · "
        f"Covers {scan.device_count} device(s) and {scan.ruleset_count} ruleset(s)",
        s["muted"],
    ))

    story.append(Spacer(1, 6))
    story.append(_summary_table(scan, results, s))

    story.append(Paragraph("What this report covers", s["h2"]))
    story.append(Paragraph(
        "This report compares your discovered network posture against the CIS Controls v8 "
        "and CIS Cisco IOS benchmarks. Each finding includes the offending rule or banner, "
        "the affected target, and the recommended remediation — ready for tickets and "
        "compliance evidence.",
        s["body"],
    ))

    # ── Failures first — the section auditors and incident responders read ──
    failures = [r for r in results if r.outcome == "fail"]
    if failures:
        story.append(Paragraph(f"Findings · {len(failures)} requiring attention", s["h2"]))
        # Group by severity
        by_sev: dict[str, list[BenchmarkResult]] = {}
        for r in failures:
            by_sev.setdefault(r.severity, []).append(r)
        order = ("critical", "high", "medium", "low", "info")
        for sev in order:
            items = by_sev.get(sev, [])
            if not items:
                continue
            story.append(Paragraph(f"{sev.title()} severity ({len(items)})", s["h3"]))
            for r in items:
                story.append(KeepTogether(_finding_block(r, s)))
                story.append(Spacer(1, 4))
    else:
        story.append(Paragraph("Findings", s["h2"]))
        story.append(Paragraph("No failing checks. Nice.", s["body"]))

    # ── Passing controls (compact) ───────────────────────────────────────────
    passes = [r for r in results if r.outcome == "pass"]
    if passes:
        story.append(PageBreak())
        story.append(Paragraph(f"Passing controls · {len(passes)}", s["h2"]))
        story.append(Paragraph(
            "Evidence that these controls held at the time of the scan. Useful for "
            "compliance attestations.",
            s["muted"],
        ))
        story.append(_passes_table(passes, s))

    # ── Devices reviewed ─────────────────────────────────────────────────────
    if devices:
        story.append(PageBreak())
        story.append(Paragraph(f"Devices reviewed · {len(devices)}", s["h2"]))
        story.append(_devices_table(devices, s))

    # ── Firewall rules reviewed ──────────────────────────────────────────────
    if rulesets:
        story.append(PageBreak())
        total_rules = sum(len(rs.rules) for rs in rulesets)
        story.append(Paragraph(
            f"Firewall rules reviewed · {total_rules} across {len(rulesets)} ruleset(s)",
            s["h2"],
        ))
        for rs in rulesets:
            story.append(Paragraph(f"{rs.name} ({rs.source_type})", s["h3"]))
            story.append(_rules_table(rs, s))
            story.append(Spacer(1, 4))

    doc.build(story)
    return buf.getvalue()


def _summary_table(scan: ScanSummary, results: list[BenchmarkResult],
                   s: dict[str, ParagraphStyle]) -> Table:
    total = scan.pass_count + scan.fail_count
    pass_rate = round((scan.pass_count / total) * 100) if total else 0
    fail_sev = {sev: sum(1 for r in results if r.outcome == "fail" and r.severity == sev)
                for sev in ("critical", "high", "medium", "low")}
    cells = [
        [Paragraph("PASS RATE", s["label"]),
         Paragraph("CONTROLS PASSED", s["label"]),
         Paragraph("FINDINGS", s["label"]),
         Paragraph("CRITICAL / HIGH", s["label"])],
        [Paragraph(f"<b>{pass_rate}%</b>",
                   ParagraphStyle("k1", parent=s["h1"], fontSize=24, textColor=STEELBLUE)),
         Paragraph(f"<b>{scan.pass_count}</b>",
                   ParagraphStyle("k2", parent=s["h1"], fontSize=24, textColor=SUCCESS)),
         Paragraph(f"<b>{scan.fail_count}</b>",
                   ParagraphStyle("k3", parent=s["h1"], fontSize=24, textColor=DANGER)),
         Paragraph(
             f"<b>{fail_sev['critical']}</b> / <b>{fail_sev['high']}</b>",
             ParagraphStyle("k4", parent=s["h1"], fontSize=18, textColor=WARNING)),
        ],
    ]
    t = Table(cells, colWidths=[44 * mm] * 4, hAlign="LEFT")
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), ALICE),
        ("BOX", (0, 0), (-1, -1), 0.4, MUTED),
        ("INNERGRID", (0, 0), (-1, -1), 0.4, MUTED),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))
    return t


def _sev_color(sev: str) -> colors.Color:
    return {
        "critical": DANGER, "high": WARNING, "medium": WARNING,
        "low": SKYBLUE, "info": SKYBLUE,
    }.get(sev, MUTED)


def _finding_block(r: BenchmarkResult, s: dict[str, ParagraphStyle]) -> list:
    sev_color = _sev_color(r.severity)
    pill = ParagraphStyle("pill", parent=s["label"], textColor=colors.white,
                          backColor=sev_color, alignment=1, leading=11)
    head = Table([[
        Paragraph(f" {r.severity.upper()} ", pill),
        Paragraph(f"<b>{r.check_id}</b> &nbsp; {r.title}", s["body"]),
        Paragraph(f"<font color='#616566'>{r.cis_reference}</font>", s["muted"]),
    ]], colWidths=[18 * mm, 110 * mm, 46 * mm])
    head.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
    ]))

    target_line = Paragraph(
        f"<font color='#616566'>{r.target_kind}</font> "
        f"<font face='Courier' color='#0476ac'>{r.target_id}</font>",
        s["body"],
    )
    evidence = [Paragraph("• " + _escape(e), s["evidence"]) for e in r.evidence] or \
               [Paragraph("(no evidence captured)", s["muted"])]
    out = [head, target_line, *evidence]
    if r.remediation:
        out.append(Paragraph(f"<b>Remediation:</b> {_escape(r.remediation)}", s["remediation"]))
    return out


def _passes_table(passes: list[BenchmarkResult], s: dict[str, ParagraphStyle]) -> Table:
    rows = [[
        Paragraph("CHECK", s["label"]),
        Paragraph("CIS REFERENCE", s["label"]),
        Paragraph("TARGET", s["label"]),
    ]]
    for r in passes:
        rows.append([
            Paragraph(f"<b>{r.check_id}</b><br/>{_escape(r.title)}", s["body"]),
            Paragraph(_escape(r.cis_reference), s["muted"]),
            Paragraph(f"<font face='Courier'>{_escape(r.target_id)}</font>", s["muted"]),
        ])
    t = Table(rows, colWidths=[70 * mm, 50 * mm, 54 * mm], repeatRows=1)
    t.setStyle(_table_style(header_bg=ALICE, header_fg=STEELBLUE))
    return t


def _devices_table(devices: list[Device], s: dict[str, ParagraphStyle]) -> Table:
    rows = [[
        Paragraph("IP", s["label"]),
        Paragraph("HOSTNAME", s["label"]),
        Paragraph("OPEN PORTS", s["label"]),
    ]]
    for d in devices:
        ports = ", ".join(
            f"{p.port}/{p.protocol}" + (f" ({p.service.name})" if p.service and p.service.name else "")
            for p in d.open_ports
        ) or "—"
        rows.append([
            Paragraph(f"<font face='Courier'><b>{d.ip}</b></font>", s["body"]),
            Paragraph(_escape(d.hostname or "—"), s["body"]),
            Paragraph(_escape(ports), s["muted"]),
        ])
    t = Table(rows, colWidths=[40 * mm, 50 * mm, 84 * mm], repeatRows=1)
    t.setStyle(_table_style(header_bg=ALICE, header_fg=STEELBLUE))
    return t


def _rules_table(rs: FirewallRuleSet, s: dict[str, ParagraphStyle]) -> Table:
    rows = [[
        Paragraph("DIR", s["label"]),
        Paragraph("ACTION", s["label"]),
        Paragraph("PROTO", s["label"]),
        Paragraph("FROM", s["label"]),
        Paragraph("TO", s["label"]),
        Paragraph("PORT", s["label"]),
    ]]
    for r in rs.rules:
        rows.append([
            Paragraph(r.direction[:3].upper(), s["body"]),
            Paragraph(_action_html(r.action), s["body"]),
            Paragraph(_escape(r.protocol), s["body"]),
            Paragraph(f"<font face='Courier'>{_escape(r.source)}</font>", s["body"]),
            Paragraph(f"<font face='Courier'>{_escape(r.destination)}</font>", s["body"]),
            Paragraph(f"<font face='Courier'>{_escape(r.port_range)}</font>", s["body"]),
        ])
    t = Table(rows, colWidths=[14 * mm, 24 * mm, 18 * mm, 50 * mm, 50 * mm, 18 * mm], repeatRows=1)
    t.setStyle(_table_style(header_bg=ALICE, header_fg=STEELBLUE))
    return t


def _action_html(action: str) -> str:
    color = "#059669" if action == "allow" else (
        "#dc2626" if action in {"deny", "default-deny"} else "#616566")
    return f"<font color='{color}'><b>{action}</b></font>"


def _table_style(header_bg: colors.Color, header_fg: colors.Color) -> TableStyle:
    return TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), header_bg),
        ("TEXTCOLOR",  (0, 0), (-1, 0), header_fg),
        ("LINEBELOW",  (0, 0), (-1, 0), 0.5, header_fg),
        ("LINEBELOW",  (0, 1), (-1, -1), 0.25, MUTED),
        ("LEFTPADDING",  (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING",   (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING",(0, 0), (-1, -1), 4),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ])


def _escape(text: str | None) -> str:
    """Escape user-supplied text for the XML-flavoured paragraph parser."""
    if text is None:
        return ""
    return (
        text.replace("&", "&amp;")
            .replace("<", "&lt;")
            .replace(">", "&gt;")
    )
