"""Build the review PDF from the editable GDD. No app dependencies are changed."""
from pathlib import Path
import html
import re

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.cidfonts import UnicodeCIDFont
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, PageBreak, Table, TableStyle,
    Preformatted, Flowable,
)

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'docs/gdd/blade-evolution-gdd-v0.1.md'
OUTPUT = ROOT / 'output/pdf/blade-evolution-gdd-v0.1.pdf'
OUTPUT.parent.mkdir(parents=True, exist_ok=True)

FONT = 'STSong-Light'
pdfmetrics.registerFont(UnicodeCIDFont(FONT))
pdfmetrics.registerFontFamily(FONT, normal=FONT, bold=FONT, italic=FONT, boldItalic=FONT)
GREEN = colors.HexColor('#1C4B41')
INK = colors.HexColor('#273A37')
MUTED = colors.HexColor('#62736D')
PALE = colors.HexColor('#F1F5F1')
GOLD = colors.HexColor('#B58C45')
PAGE_W, PAGE_H = A4
MARGIN = 42
WIDTH = PAGE_W - MARGIN * 2

styles = {
    'body': ParagraphStyle('Body', fontName=FONT, fontSize=10.1, leading=17.1,
                           textColor=INK, spaceAfter=6, wordWrap='CJK'),
    'section': ParagraphStyle('SectionHeading', fontName=FONT, fontSize=17.4,
                              leading=24, textColor=GREEN, spaceBefore=18,
                              spaceAfter=10, keepWithNext=True, wordWrap='CJK'),
    'sub': ParagraphStyle('SubHeading', fontName=FONT, fontSize=12,
                          leading=18, textColor=GREEN, spaceBefore=12,
                          spaceAfter=6, keepWithNext=True, wordWrap='CJK'),
    'bullet': ParagraphStyle('Bullet', fontName=FONT, fontSize=10.1,
                             leading=17.1, leftIndent=11, bulletIndent=0,
                             bulletFontName='Helvetica', bulletFontSize=9,
                             textColor=INK, spaceAfter=4, wordWrap='CJK'),
    'cell': ParagraphStyle('Cell', fontName=FONT, fontSize=8.65, leading=13.3,
                           textColor=INK, wordWrap='CJK'),
    'head': ParagraphStyle('TableHead', fontName=FONT, fontSize=8.5, leading=13,
                           textColor=colors.white, wordWrap='CJK'),
    'small': ParagraphStyle('Small', fontName=FONT, fontSize=9, leading=15,
                            textColor=MUTED, spaceAfter=7, wordWrap='CJK'),
    'cover_title': ParagraphStyle('CoverTitle', fontName=FONT, fontSize=39,
                                  leading=52, textColor=GREEN, spaceAfter=5),
    'cover_sub': ParagraphStyle('CoverSub', fontName=FONT, fontSize=15.5,
                                leading=23, textColor=MUTED, spaceAfter=17),
    'cover_tag': ParagraphStyle('CoverTag', fontName=FONT, fontSize=13,
                                leading=22, textColor=INK, spaceAfter=13,
                                wordWrap='CJK'),
    'toc': ParagraphStyle('TOC', fontName=FONT, fontSize=9, leading=15,
                          textColor=GREEN, wordWrap='CJK'),
}


def ascii_dashes(text):
    return re.sub('[\u2010-\u2015\u2212]', '-', text).replace('\u00b7', ' / ')


def inline(text):
    text = ascii_dashes(text)
    parts = re.split(r'(`[^`]+`)', text)
    output = []
    for part in parts:
        if part.startswith('`') and part.endswith('`'):
            code = html.escape(part[1:-1])
            face = 'Courier' if part[1:-1].isascii() else FONT
            output.append(f'<font face="{face}" color="#245B4B">{code}</font>')
        else:
            escaped = html.escape(part)
            escaped = re.sub(r'\*\*(.+?)\*\*', r'<font color="#184C3D"><b>\1</b></font>', escaped)
            output.append(escaped)
    return ''.join(output)


def p(text, style='body'):
    return Paragraph(inline(text), styles[style])


class EvolutionStrip(Flowable):
    def __init__(self):
        super().__init__()
        self.width = WIDTH
        self.height = 157

    def draw(self):
        c = self.canv
        cell = WIDTH / 6
        palettes = ['#83908D', '#4C9F8D', '#DF9A45', '#8076BB', '#446F96', '#B89C59']
        names = ['铁片小刀', '青锋', '燎火刃', '雷鸣斩', '星陨长刀', '破晓神刃']
        levels = [1, 5, 10, 15, 20, 25]
        for i in range(6):
            cx = cell * i + cell / 2
            color = colors.HexColor(palettes[i])
            c.setFillColor(PALE)
            c.roundRect(i * cell + 3, 2, cell - 6, 148, 5, fill=1, stroke=0)
            c.setFont('Helvetica', 8)
            c.setFillColor(MUTED)
            c.drawCentredString(cx, 133, f'Lv.{levels[i]}')
            c.saveState()
            c.translate(cx, 28)
            c.rotate(-12 + i * 2)
            c.setStrokeColor(color)
            c.setFillColor(color)
            c.roundRect(-2.4, 0, 4.8, 17, 1.5, fill=1, stroke=0)
            c.roundRect(-8 - i * .8, 15, 16 + i * 1.6, 3.5, 1.5, fill=1, stroke=0)
            shapes = [
                [(-4, 19), (4, 19), (3, 47), (0, 53), (-4, 48)],
                [(-4, 19), (4, 19), (4, 64), (0, 73), (-4, 64)],
                [(-5, 19), (5, 19), (7, 53), (13, 79), (0, 71), (-5, 56)],
                [(-5, 19), (5, 19), (8, 36), (4, 44), (7, 71), (0, 83), (-5, 66), (-7, 42)],
                [(-7, 19), (7, 19), (8, 68), (4, 82), (-2, 88), (-8, 66)],
                [(-8, 19), (8, 19), (6, 71), (0, 93), (-7, 75), (-9, 48)],
            ]
            path = c.beginPath()
            path.moveTo(*shapes[i][0])
            for x, y in shapes[i][1:]:
                path.lineTo(x, y)
            path.close()
            c.drawPath(path, fill=1, stroke=0)
            c.setStrokeColor(colors.HexColor('#F4F0DA'))
            c.setLineWidth(1.1)
            c.line(1, 22, 1, 45 + i * 6)
            if i >= 3:
                c.line(-5, 11, -12, 17)
                c.line(5, 11, 12, 17)
            if i == 5:
                c.setStrokeColor(GOLD)
                c.setLineWidth(.7)
                c.arc(-20, 27, 20, 82, 75, 190)
                c.arc(-17, 24, 17, 79, 250, 105)
                c.setFillColor(GOLD)
                c.circle(-14, 55, 1.8, fill=1, stroke=0)
                c.circle(14, 70, 1.5, fill=1, stroke=0)
            c.restoreState()
            c.setFont(FONT, 9)
            c.setFillColor(GREEN)
            c.drawCentredString(cx, 10, names[i])


def table(rows):
    heads = rows[0]
    n = len(heads)
    if heads[0].startswith('形态'):
        weights = [.13, .105, .19, .285, .17, .12]
    elif heads[0] == '类型':
        weights = [.105, .175, .09, .09, .075, .07, .395]
    elif heads[0] == '锻造':
        weights = [.13, .32, .13, .42]
    elif n == 2:
        weights = [.26, .74]
    elif n == 3:
        weights = [.23, .27, .50]
    elif n == 4:
        weights = [.23, .27, .25, .25]
    else:
        weights = [1 / n] * n
    total = sum(weights)
    widths = [WIDTH * w / total for w in weights]
    data = []
    for row_index, row in enumerate(rows):
        data.append([p(cell, 'head' if row_index == 0 else 'cell') for cell in row])
    t = Table(data, colWidths=widths, repeatRows=1, hAlign='LEFT')
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), GREEN),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, PALE]),
        ('LINEBELOW', (0, 0), (-1, 0), .5, GREEN),
        ('LINEBELOW', (0, 1), (-1, -1), .3, colors.HexColor('#DAE3DC')),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))
    return t


class GDDDocument(SimpleDocTemplate):
    def afterFlowable(self, flowable):
        if isinstance(flowable, Paragraph) and flowable.style.name == 'SectionHeading':
            text = flowable.getPlainText()
            number = re.match(r'(\d+)\.', text).group(1)
            self.canv.bookmarkPage(f'sec-{number}')
            self.canv.addOutlineEntry(text, f'sec-{number}', level=0)


def page_frame(canvas, doc):
    canvas.saveState()
    canvas.setStrokeColor(colors.HexColor('#D7E0D8'))
    canvas.setLineWidth(.5)
    canvas.line(MARGIN, PAGE_H - 29, PAGE_W - MARGIN, PAGE_H - 29)
    canvas.setFont('Helvetica', 7)
    canvas.setFillColor(MUTED)
    canvas.drawString(MARGIN, PAGE_H - 21, 'BLADE EVOLUTION / GAME DESIGN DOCUMENT')
    canvas.drawRightString(PAGE_W - MARGIN, PAGE_H - 21, 'v0.1 / 2026-10-27')
    canvas.line(MARGIN, 30, PAGE_W - MARGIN, 30)
    canvas.setFont(FONT, 7.3)
    canvas.drawString(MARGIN, 18, '设计参数待原型验证')
    canvas.setFont('Helvetica', 7.3)
    canvas.drawRightString(PAGE_W - MARGIN, 18, f'{doc.page}')
    canvas.restoreState()


def build():
    source = SOURCE.read_text()
    story = []
    story.append(Spacer(1, 18))
    story.append(Paragraph('G A M E   D E S I G N   D O C U M E N T', ParagraphStyle('Kicker', fontName='Helvetica', fontSize=8, textColor=GOLD, spaceAfter=18)))
    story.append(p('刃之进化', 'cover_title'))
    story.append(p('2D 割草肉鸽 · 单局武器进化', 'cover_sub'))
    story.append(p('从一把不起眼的小刀开始，砍出一局属于自己的神兵。', 'cover_tag'))
    story.append(p('已确认：每局从小刀重新成长。局外保留图鉴、外观与战绩。', 'small'))
    story.append(Spacer(1, 10))
    story.append(EvolutionStrip())
    story.append(Spacer(1, 15))
    summary = [
        [p('6 阶刀型', 'cover_sub'), p('Lv.1-30', 'cover_sub'), p('最长 8:30', 'cover_sub')],
        [p('轮廓、刀光与手感共同进化', 'small'), p('5 次锻造三选一', 'small'), p('7 分钟生存＋90 秒首领战', 'small')],
    ]
    s = Table(summary, colWidths=[WIDTH / 3] * 3)
    s.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'TOP'), ('LEFTPADDING', (0, 0), (-1, -1), 0), ('RIGHTPADDING', (0, 0), (-1, -1), 8), ('BOTTOMPADDING', (0, 0), (-1, -1), 4)]))
    story.append(s)
    story.append(Spacer(1, 10))
    story.append(p('默认：单人 PvE、2D 俯视、手机竖屏优先、电脑自适应。背景参考简洁的圆形单位竞技场，角色、刀型、界面与音效原创。', 'small'))
    story.append(p('版本 v0.1 · 2026-10-27。数值、节奏和性能目标均为原型起点，尚未经过可玩原型验证。封面刀型为轮廓方向示意，正式美术以第 6、10 节规范为准。', 'small'))
    story.append(Spacer(1, 8))
    labels = ['定位', '核心循环', '操作与相机', '战斗规则', '经验与节奏', '刀型进化', '锻造选择', '怪物与首领', '关卡时间线', '画面与特效', '界面与引导', '结算与收藏', '首版范围', '技术与性能', '验收与调参']
    nav = []
    for row in range(5):
        nav.append([Paragraph(f'<link href="#sec-{row * 3 + col + 1}" color="#1C4B41">{row * 3 + col + 1:02d}　{labels[row * 3 + col]}</link>', styles['toc']) for col in range(3)])
    nav_table = Table(nav, colWidths=[WIDTH / 3] * 3)
    nav_table.setStyle(TableStyle([('BACKGROUND', (0, 0), (-1, -1), PALE), ('TOPPADDING', (0, 0), (-1, -1), 5), ('BOTTOMPADDING', (0, 0), (-1, -1), 5), ('LEFTPADDING', (0, 0), (-1, -1), 10)]))
    story.append(nav_table)
    story.append(PageBreak())

    lines = source[source.index('## 1. 游戏定位'):].splitlines()
    i = 0
    paragraph = []

    def flush():
        if paragraph:
            story.append(p(' '.join(paragraph)))
            paragraph.clear()

    while i < len(lines):
        line = lines[i].strip()
        if not line:
            flush(); i += 1; continue
        if line.startswith('```'):
            flush(); i += 1; code = []
            while i < len(lines) and not lines[i].strip().startswith('```'):
                code.append(ascii_dashes(lines[i])); i += 1
            code_style = ParagraphStyle('Diagram', fontName=FONT, fontSize=9.5, leading=14.5, textColor=GREEN)
            pre = Preformatted('\n'.join(code), code_style)
            block = Table([[pre]], colWidths=[WIDTH])
            block.setStyle(TableStyle([('BACKGROUND', (0, 0), (-1, -1), PALE), ('LEFTPADDING', (0, 0), (-1, -1), 10), ('RIGHTPADDING', (0, 0), (-1, -1), 10), ('TOPPADDING', (0, 0), (-1, -1), 10), ('BOTTOMPADDING', (0, 0), (-1, -1), 10)]))
            story.extend([block, Spacer(1, 9)]); i += 1; continue
        if line.startswith('### '):
            flush(); story.append(p(line[4:], 'sub')); i += 1; continue
        if line.startswith('## '):
            flush(); story.append(p(line[3:], 'section')); i += 1; continue
        if line.startswith('|'):
            flush(); rows = []
            while i < len(lines) and lines[i].strip().startswith('|'):
                row = [cell.strip() for cell in lines[i].strip().strip('|').split('|')]
                if not all(re.fullmatch(r':?-{3,}:?', cell) for cell in row):
                    rows.append(row)
                i += 1
            if any(len(row) != len(rows[0]) for row in rows):
                raise ValueError(f'Inconsistent table near {rows[0]}')
            story.extend([table(rows), Spacer(1, 10)]); continue
        if line == '---':
            flush(); story.append(Spacer(1, 8)); i += 1; continue
        if line.startswith('- '):
            flush()
            first = i == 0 or not lines[i - 1].strip().startswith('- ')
            following = i + 1 < len(lines) and lines[i + 1].strip().startswith('- ')
            bullet_style = ParagraphStyle('BulletKeepPair', parent=styles['bullet'], keepWithNext=bool(first and following))
            story.append(Paragraph(inline(line[2:]), bullet_style, bulletText='-'))
            i += 1; continue
        if re.match(r'^\d+\. ', line):
            flush(); story.append(p(line)); i += 1; continue
        if line.startswith('> '):
            flush(); story.append(p(line[2:], 'small')); i += 1; continue
        paragraph.append(line); i += 1
    flush()
    doc = GDDDocument(str(OUTPUT), pagesize=A4, rightMargin=MARGIN, leftMargin=MARGIN,
                      topMargin=43, bottomMargin=44, title='刃之进化 - 游戏设计文档 v0.1',
                      author='Game Design', subject='单局进化与简洁画面的 2D 割草肉鸽 GDD')
    doc.build(story, onFirstPage=page_frame, onLaterPages=page_frame)
    print(OUTPUT)


if __name__ == '__main__':
    build()
