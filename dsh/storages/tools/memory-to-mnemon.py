#!/usr/bin/env python3
"""memory-to-mnemon — 把 reasonix memory 语料喂进 mnemon（全量重喂，靠 mnemon 自动去重）

用法:
  python memory-to-mnemon.py [--dry-run] [--data-dir D] [--src DIR] [--draft PATH]

设计:
  * 全量重喂是安全的 —— mnemon import 走正常写入路径（去重 + 图边 + lifecycle）
  * 按 markdown 的 `##` 分节切块，用**字节**预算（mnemon 是 Go，len() 数 UTF-8 字节：
    content ≤ 8000 字节、每个 tag ≤ 100 字节）—— 初版按字符数算会直接被拒
"""
import os, re, json, sys, subprocess, argparse, datetime, shutil

def blen(s): return len(s.encode("utf-8"))
def cutb(s, maxb):
    if blen(s) <= maxb: return s
    b = s.encode("utf-8")[:maxb]
    while b and (b[-1] & 0xC0) == 0x80: b = b[:-1]
    return b.decode("utf-8", "ignore")

MAXB, TAGB = 7500, 100

def build_insights(src):
    files = sorted(f for f in os.listdir(src) if f.endswith(".md") and f != "MEMORY.md")
    ins = []
    for f in files:
        t = open(os.path.join(src, f), encoding="utf-8", errors="replace").read()
        fms, body = "", t
        if t.startswith("---"):
            i = t.find("\n---", 3)
            if i != -1:
                j = t.find("\n", i + 4)
                fms, body = t[:i], t[j + 1:]
        def g(k):
            m = re.search(rf"^{k}:\s*(.+)$", fms, re.M)
            return m.group(1).strip().strip('"') if m else ""
        name = g("name") or f[:-3]
        desc = g("description")
        tags = [cutb(x.strip(), TAGB) for x in re.split(r"[,，]", g("keywords")) if x.strip()][:8]
        if cutb(name, TAGB) not in tags: tags.append(cutb(name, TAGB))
        ft = g("fact_type") or "reference"
        cat = {"feedback": "preference", "user": "context", "project": "context"}.get(ft, "fact")
        # 分层 importance —— 关键：mnemon 的 gc 把 importance >= 4 视为 immune，
        # 若全员 4 则 importance decay 完全失效（实测 candidates_found: 0）
        # 分层 importance（mnemon 1-5；gc threshold 0.5 归一化后约等于 importance 2.5，
        # 所以 3 已属"高分不可回收"区，低价值历史记录必须落到 1-2 才算真正可 decay）
        low = (name + desc).lower()
        HIST = ("工具-", "下载", "安装记录", "电影", "ocr", "ppt", "word", "迅雷", "b站", "维基", "zim",
                "codex桌面", "工具箱", "桌面挂件", "鲸鱼娘", "钢琴", "vscode-semester")
        if ft == "feedback" or "元规则" in name or name.startswith("rule-") or "user-persona" in name:
            imp = 5
        elif any(k in low for k in ("铁律", "规范", "禁止", "must", "画像")):
            imp = 5
        elif ft == "user" or ft == "project":
            imp = 4
        elif any(k in low for k in HIST):
            imp = 1      # 历史记录类：价值随时间衰减，应被 gc 回收
        elif any(k in low for k in ("dsh", "reasonix", "memory", "备份", "脱敏", "网关", "goat", "websearch")):
            imp = 4      # 当前仍在使用的基础设施
        else:
            imp = 2      # 普通 reference：可被 gc 评审
        head = cutb((f"# {name}\n{desc}\n\n" if desc else f"# {name}\n\n"), 600)
        secs = [s for s in re.split(r"\n(?=## )", body.strip()) if s.strip()]
        chunks, cur = [], head
        for s in secs:
            if blen(cur) + blen(s) + 2 <= MAXB:
                cur += s + "\n\n"
            else:
                if cur.strip() != head.strip(): chunks.append(cur.strip())
                if blen(s) + blen(head) > MAXB:
                    room = MAXB - blen(head) - 24
                    buf, acc = b"", ""
                    for ch in s:
                        cb = ch.encode("utf-8")
                        if len(buf) + len(cb) > room:
                            chunks.append(head + "（续）\n" + acc); buf, acc = b"", ""
                        buf += cb; acc += ch
                    if acc: chunks.append(head + "（续）\n" + acc)
                    cur = head
                else:
                    cur = head + "（续）\n" + s + "\n\n"
        if cur.strip() != head.strip(): chunks.append(cur.strip())
        for c in chunks:
            ins.append({"content": cutb(c, MAXB), "category": cat, "importance": imp, "tags": tags, "source": "user"})
    return files, ins

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", default=os.path.expanduser("~/.reasonix/memory/global"))
    ap.add_argument("--draft", default=os.path.expanduser("~/.dsh/storages/mnemon-draft.json"))
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()
    files, ins = build_insights(a.src)
    draft = {"schema_version": "1", "insights": ins}
    open(a.draft, "w", encoding="utf-8", newline="").write(json.dumps(draft, ensure_ascii=False))
    print(f"{len(files)} 个 fact -> {len(ins)} 条 insight")
    print(f"  max content {max(blen(x['content']) for x in ins)} 字节 / max tag {max(blen(t) for x in ins for t in x['tags'])} 字节")
    # Windows 上 mnemon 是 npm 的 .cmd shim —— subprocess 不带 shell 找不到它
    mnemon = os.environ.get("MNEMON_BIN") or shutil.which("mnemon") or "mnemon.cmd"
    cmd = f'"{mnemon}" import "{a.draft}"' + (" --dry-run" if a.dry_run else "")
    r = subprocess.run(cmd, shell=True, capture_output=True, text=True, encoding="utf-8", errors="replace")
    tail = (r.stdout or r.stderr or "").strip().splitlines()
    print("  " + "\n  ".join(tail[-4:]))
    return r.returncode

if __name__ == "__main__":
    sys.exit(main())
