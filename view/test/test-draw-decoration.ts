import {EditorView, ViewField, Decoration, DecorationSet, WidgetType, DecoratedRange} from "../src/"
import {tempEditor, requireFocus} from "./temp-editor"
import {StateField, EditorSelection} from "../../state/src"
import {Slot} from "../../extension/src/extension"
import ist from "ist"

const filterDeco = Slot.define<(from: number, to: number, spec: any) => boolean>()
const addDeco = Slot.define<DecoratedRange[]>()

function decos(startState: DecorationSet = Decoration.none) {
  let field = new StateField<DecorationSet>({
    init() { return startState },
    apply(tr, value) {
      if (tr.docChanged) value = value.map(tr.changes)
      let add = tr.getMeta(addDeco), filter = tr.getMeta(filterDeco)
      if (add || filter) value = value.update(add, filter)
      return value
    }
  })
  return [
    ViewField.decorations({
      create({state}) { return state.getField(field) },
      update(_, {state}) { return state.getField(field) },
      map: false
    }),
    field.extension
  ]
}

function d(from: number, to: any, spec: any = null) {
  return Decoration.mark(from, to, typeof spec == "string" ? {attributes: {[spec]: "y"}} : spec)
}

function w(pos: number, widget: WidgetType<any>, side: number = 0) {
  return Decoration.widget(pos, {widget, side})
}

function l(pos: number, attrs: any) {
  return Decoration.line(pos, typeof attrs == "string" ? {attributes: {class: attrs}} : attrs)
}

function decoEditor(doc: string, decorations: any = []) {
  return tempEditor(doc, decos(Decoration.set(decorations)))
}

describe("EditorView decoration", () => {
  it("renders tag names", () => {
    let cm = decoEditor("one\ntwo", d(2, 5, {tagName: "em"}))
    ist(cm.contentDOM.innerHTML, "<div class=\"codemirror-line\">on<em>e</em></div><div class=\"codemirror-line\"><em>t</em>wo</div>")
  })

  it("renders attributes", () => {
    let cm = decoEditor("foo bar", [d(0, 3, {attributes: {title: "t"}}),
                                    d(4, 7, {attributes: {lang: "nl"}})])
    ist(cm.contentDOM.querySelectorAll("[title]").length, 1)
    ist((cm.contentDOM.querySelector("[title]") as any).title, "t")
    ist(cm.contentDOM.querySelectorAll("[lang]").length, 1)
  })

  it("updates for added decorations", () => {
    let cm = decoEditor("hello\ngoodbye")
    cm.dispatch(cm.state.transaction.addMeta(addDeco([d(2, 8, {class: "c"})])))
    let spans = cm.contentDOM.querySelectorAll(".c")
    ist(spans.length, 2)
    ist(spans[0].textContent, "llo")
    ist(spans[0].previousSibling!.textContent, "he")
    ist(spans[1].textContent, "go")
    ist(spans[1].nextSibling!.textContent, "odbye")
  })

  it("updates for removed decorations", () => {
    let cm = decoEditor("one\ntwo\nthree", [d(1, 12, {class: "x"}),
                                            d(4, 7, {tagName: "strong"})])
    cm.dispatch(cm.state.transaction.addMeta(filterDeco((from: number) => from == 4)))
    ist(cm.contentDOM.querySelectorAll(".x").length, 0)
    ist(cm.contentDOM.querySelectorAll("strong").length, 1)
  })

  it("doesn't update DOM that doesn't need to change", () => {
    let cm = decoEditor("one\ntwo", [d(0, 3, {tagName: "em"})])
    let secondLine = cm.contentDOM.lastChild!, secondLineText = secondLine.firstChild
    cm.dispatch(cm.state.transaction.addMeta(filterDeco(() => false)))
    ist(cm.contentDOM.lastChild, secondLine)
    ist(secondLine.firstChild, secondLineText)
  })

  it("combines decoration classes", () => {
    let cm = decoEditor("abcdef", [d(0, 4, {class: "a"}), d(2, 6, {class: "b"})])
    ist(cm.contentDOM.querySelectorAll(".a").length, 2)
    ist(cm.contentDOM.querySelectorAll(".b").length, 2)
    ist(cm.contentDOM.querySelectorAll(".a.b").length, 1)
  })

  it("combines decoration styles", () => {
    let cm = decoEditor("abc", [d(1, 2, {attributes: {style: "color: red"}}),
                                d(1, 2, {attributes: {style: "text-decoration: underline"}})])
    let span = cm.contentDOM.querySelector("span")!
    ist(span.style.color, "red")
    ist(span.style.textDecoration, "underline")
  })

  it("drops entirely deleted decorations", () => {
    let cm = decoEditor("abc", [d(1, 2, {inclusiveStart: true, inclusiveEnd: true, tagName: "strong"})])
    cm.dispatch(cm.state.transaction.replace(0, 3, "a"))
    ist(cm.contentDOM.querySelector("strong"), null)
  })

  it("shrinks inclusive decorations when their sides are replaced", () => {
    let cm = decoEditor("abcde", [d(1, 4, {inclusiveStart: true, inclusiveEnd: true, tagName: "strong"})])
    cm.dispatch(cm.state.transaction.replace(3, 5, "a"))
    cm.dispatch(cm.state.transaction.replace(0, 2, "a"))
    ist(cm.contentDOM.querySelector("strong")!.textContent, "c")
  })

  class WordWidget extends WidgetType<string> {
    eq(otherValue: string) { return this.value.toLowerCase() == otherValue.toLowerCase() }
    toDOM() {
      let dom = document.createElement("strong")
      dom.textContent = this.value
      return dom
    }
  }

  describe("widget", () => {
    class OtherWidget extends WidgetType<string> {
      toDOM() { return document.createElement("img") }
    }

    it("draws widgets", () => {
      let cm = decoEditor("hello", [w(4, new WordWidget("hi"))])
      let elt = cm.contentDOM.querySelector("strong")!
      ist(elt)
      ist(elt.textContent, "hi")
      ist(elt.previousSibling!.textContent, "hell")
      ist(elt.nextSibling!.textContent, "o")
      ist(elt.contentEditable, "false")
    })

    it("supports editing around widgets", () => {
      let cm = decoEditor("hello", [w(4, new WordWidget("hi"))])
      cm.dispatch(cm.state.transaction.replace(3, 4, "").replace(3, 4, ""))
      ist(cm.contentDOM.querySelector("strong"))
    })

    it("compares widgets with their eq method", () => {
      let cm = decoEditor("hello", [w(4, new WordWidget("hi"))])
      let elt = cm.contentDOM.querySelector("strong")
      cm.dispatch(cm.state.transaction
                  .addMeta(addDeco([w(4, new WordWidget("HI"))]))
                  .addMeta(filterDeco(() => false)))
      ist(elt, cm.contentDOM.querySelector("strong"))
    })

    it("notices replaced replacement decorations", () => {
      let cm = decoEditor("abc", [Decoration.replace(1, 2, {widget: new WordWidget("X")})])
      cm.dispatch(cm.state.transaction
                  .addMeta(addDeco([Decoration.replace(1, 2, {widget: new WordWidget("Y")})]))
                  .addMeta(filterDeco(() => false)))
      ist(cm.contentDOM.textContent, "aYc")
    })

    it("doesn't consider different widgets types equivalent", () => {
      let cm = decoEditor("hello", [w(4, new WordWidget("hi"))])
      let elt = cm.contentDOM.querySelector("strong")
      cm.dispatch(cm.state.transaction
                  .addMeta(addDeco([w(4, new OtherWidget("hi"))]))
                  .addMeta(filterDeco(() => false)))
      ist(elt, cm.contentDOM.querySelector("strong"), "!=")
    })

    it("orders widgets by side", () => {
      let cm = decoEditor("hello", [w(4, new WordWidget("C"), 10),
                                    w(4, new WordWidget("B")),
                                    w(4, new WordWidget("A"), -1)])
      let widgets = cm.contentDOM.querySelectorAll("strong")
      ist(widgets.length, 3)
      ist(widgets[0].textContent, "A")
      ist(widgets[1].textContent, "B")
      ist(widgets[2].textContent, "C")
    })

    it("places the cursor based on side", () => {
      let cm = requireFocus(
        decoEditor("abc", [w(2, new WordWidget("A"), -1),
                           w(2, new WordWidget("B"), 1)]))
      cm.dispatch(cm.state.transaction.setSelection(EditorSelection.single(2)))
      let domSel = document.getSelection()!
      ist(domSel.focusNode.childNodes[domSel.focusOffset - 1].textContent, "A")
      ist(domSel.focusNode.childNodes[domSel.focusOffset].textContent, "B")
    })

    it("preserves widgets alongside edits regardless of side", () => {
      let cm = decoEditor("abc", [w(1, new WordWidget("x"), -1), w(1, new WordWidget("y"), 1),
                                  w(2, new WordWidget("z"), -1), w(2, new WordWidget("q"), 1)])
      cm.dispatch(cm.state.transaction.replace(1, 2, "B"))
      ist(cm.contentDOM.textContent, "axyBzqc")
    })

    it("can update widgets in an empty document", () => {
      let cm = decoEditor("", [w(0, new WordWidget("A"))])
      cm.dispatch(cm.state.transaction.addMeta(addDeco([w(0, new WordWidget("B"))])))
      ist(cm.contentDOM.querySelectorAll("strong").length, 2)
    })
  })

  describe("replaced", () => {
    function r(from: number, to: number, spec: any) { return Decoration.replace(from, to, spec) }

    it("omits replaced content", () => {
      let cm = decoEditor("foobar", [r(1, 4, {})])
      ist(cm.contentDOM.textContent, "far")
    })

    it("can replace across lines", () => {
      let cm = decoEditor("foo\nbar\nbaz\nbug", [r(1, 14, {})])
      ist(cm.contentDOM.childNodes.length, 1)
      ist(cm.contentDOM.firstChild!.textContent, "fg")
    })

    it("draws replacement widgets", () => {
      let cm = decoEditor("foo\nbar\nbaz", [r(6, 9, {widget: new WordWidget("X")})])
      ist(cm.contentDOM.textContent, "foobaXaz")
    })

    it("can handle multiple overlapping replaced ranges", () => {
      let cm = decoEditor("foo\nbar\nbaz\nbug", [r(1, 6, {}), r(6, 9, {}), r(8, 14, {})])
      ist(cm.contentDOM.childNodes.length, 1)
      ist(cm.contentDOM.firstChild!.textContent, "fg")
    })
  })

  describe("line attributes", () => {
    function classes(cm: EditorView, ...lines: string[]) {
      for (let i = 0; i < lines.length; i++) {
        let className = (cm.contentDOM.childNodes[i] as HTMLElement).className.split(" ").filter(c => c != "codemirror-line").sort().join(" ")
        ist(className, lines[i])
      }
    }

    it("adds line attributes", () => {
      let cm = decoEditor("abc\ndef\nghi", [l(0, "a"), l(0, "b"), l(1, "c"), l(8, "d")])
      classes(cm, "a b", "", "d")
    })

    it("updates when line attributes are added", () => {
      let cm = decoEditor("foo\nbar", [l(0, "a")])
      cm.dispatch(cm.state.transaction.addMeta(addDeco([l(0, "b"), l(4, "c")])))
      classes(cm, "a b", "c")
    })

    it("updates when line attributes are removed", () => {
      let ds = [l(0, "a"), l(0, "b"), l(4, "c")]
      let cm = decoEditor("foo\nbar", ds)
      cm.dispatch(cm.state.transaction.addMeta(
        filterDeco((_f: number, _t: number, deco: Decoration) => !ds.slice(1).some(r => r.value == deco))))
      classes(cm, "a", "")
    })

    it("handles line joining properly", () => {
      let cm = decoEditor("x\ny\nz", [l(0, "a"), l(2, "b"), l(4, "c")])
      cm.dispatch(cm.state.transaction.replace(1, 4, ""))
      classes(cm, "a")
    })

    it("handles line splitting properly", () => {
      let cm = decoEditor("abc", [l(0, "a")])
      cm.dispatch(cm.state.transaction.replace(1, 2, "\n"))
      classes(cm, "a", "")
    })

    it("can handle insertion", () => {
      let cm = decoEditor("x\ny\nz", [l(2, "a"), l(4, "b")])
      cm.dispatch(cm.state.transaction.replace(2, 2, "hi"))
      classes(cm, "", "a", "b")
    })
  })

  class BlockWidget extends WidgetType<string> {
    toDOM() {
      let elt = document.createElement("hr")
      elt.setAttribute("data-name", this.value)
      return elt
    }
  }

  function bw(pos: number, side = -1, name = "n") {
    return Decoration.widget(pos, {widget: new BlockWidget(name), side, block: true})
  }

  function br(from: number, to: number, name = "r", inclusive = false) {
    return Decoration.replace(from, to, {widget: new BlockWidget(name), inclusive, block: true})
  }

  function widgets(cm: EditorView, ...groups: string[][]) {
    let found: string[][] = [[]]
    for (let n: Node | null = cm.contentDOM.firstChild; n; n = n.nextSibling) {
      if ((n as HTMLElement).nodeName == "HR") found[found.length - 1].push((n as HTMLElement).getAttribute("data-name")!)
      else found.push([])
    }
    ist(JSON.stringify(found), JSON.stringify(groups))
  }

  describe("block widgets", () => {
    it("draws block widgets in the right place", () => {
      let cm = decoEditor("foo\nbar", [bw(0, -1, "A"), bw(3, 2, "C"), bw(3, 1, "B"), bw(4, -2, "D"), bw(4, -1, "E"), bw(7, 1, "F")])
      widgets(cm, ["A"], ["B", "C", "D", "E"], ["F"])
    })

    it("adds widgets when they appear", () => {
      let cm = decoEditor("foo\nbar", [bw(7, 1, "Y")])
      cm.dispatch(cm.state.transaction.addMeta(addDeco([bw(0, -1, "X"), bw(7, 2, "Z")])))
      widgets(cm, ["X"], [], ["Y", "Z"])
    })

    it("removes widgets when they vanish", () => {
      let cm = decoEditor("foo\nbar", [bw(0, -1, "A"), bw(3, 1, "B"), bw(4, -1, "C"), bw(7, 1, "D")])
      widgets(cm, ["A"], ["B", "C"], ["D"])
      cm.dispatch(cm.state.transaction.addMeta(filterDeco((_f: number, _t: number, deco: any) => deco.spec.side < 0)))
      widgets(cm, ["A"], ["C"], [])
    })

    it("draws block ranges", () => {
      let cm = decoEditor("one\ntwo\nthr\nfou", [br(4, 11, "A")])
      widgets(cm, [], ["A"], [])
    })

    // FIXME add widgets at end of doc, start of doc, end/start of lines inside doc
    // block ranges
    // widgets around block ranges
    // tests of overlapping replaced ranges, block or not

    it("doesn't redraw unchanged widgets", () => {
      let cm = decoEditor("foo\nbar", [bw(0, -1, "A"), bw(7, 1, "B")])
      let ws = cm.contentDOM.querySelectorAll("hr")
      cm.dispatch(cm.state.transaction
                  .addMeta(filterDeco((_f: number, _t: number, deco: any) => deco.spec.side < 0))
                  .addMeta(addDeco([bw(7, 1, "B")])))
      widgets(cm, ["A"], [], ["B"])
      let newWs = cm.contentDOM.querySelectorAll("hr")
      ist(newWs[0], ws[0])
      ist(newWs[1], ws[1])
    })

    it("does redraw changed widgets", () => {
      let cm = decoEditor("foo\nbar", [bw(0, -1, "A"), bw(7, 1, "B")])
      cm.dispatch(cm.state.transaction
                  .addMeta(filterDeco((_f: number, _t: number, deco: any) => deco.spec.side < 0))
                  .addMeta(addDeco([bw(7, 1, "C")])))
      widgets(cm, ["A"], [], ["C"])
    })
  })
})
