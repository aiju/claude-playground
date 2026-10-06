// Paper: documents, the places they wait, and books.
//
// A document is one physical piece of paper: one copy of a form, a card, a
// letter. Carbon copies of the same writing share a `set`. A document is
// always somewhere: in someone's hand, in a container (a tray, a rack, a
// box, a file, the post bag), or attached to a lot of work. Every move and
// every mark goes into its history.
//
// A container sits at a node on the site. A book is a bound or loose-leaf
// register with entries that point back to the documents they came from.

export class Paper {
  constructor(world) {
    this.world = world;
    this.types = new Map();
    this.docs = new Map();
    this.containers = new Map();
    this.books = new Map();
    this.seq = 0;
    this.numbers = new Map();
  }

  defineType(type) {
    this.types.set(type.id, type);
    return type;
  }

  // The next serial number in a series ("time card", "job slip", ...).
  nextNumber(series, start = 1) {
    const n = this.numbers.has(series) ? this.numbers.get(series) + 1 : start;
    this.numbers.set(series, n);
    return n;
  }

  // Create a document (and its carbon copies, if the form has them). Returns
  // the top copy; the others are in `doc.copies`.
  create(typeId, fields = {}, { by = null, at = null, no = null } = {}) {
    const type = this.types.get(typeId);
    if (!type) throw new Error(`no document type ${typeId}`);
    const set = `set${++this.seq}`;
    const copies = (type.copies || [{ colour: type.colour || 'white', to: null }]).map((c, i) => {
      const doc = {
        id: `doc${this.seq}-${i}`, type: typeId, set, copy: i, colour: c.colour || 'white', destination: c.to,
        no, fields: i === 0 ? fields : fields, marks: [], history: [], created: this.world.sim.now,
        holder: null, container: null, lot: null,
      };
      this.docs.set(doc.id, doc);
      this.note(doc, `written${by ? ` by ${by.name}` : ''}`);
      return doc;
    });
    const top = copies[0];
    top.copies = copies;
    for (const c of copies) c.siblings = copies;
    if (at) for (const c of copies) this.put(c, at);
    else if (by) for (const c of copies) this.hold(c, by);
    return top;
  }

  note(doc, text) {
    doc.history.push({ t: this.world.sim.now, text });
  }

  detach(doc) {
    if (doc.holder) {
      doc.holder.papers?.delete(doc);
      doc.holder = null;
    }
    if (doc.container) {
      doc.container.docs.delete(doc);
      doc.container = null;
    }
    if (doc.lot) {
      doc.lot.papers?.delete(doc);
      doc.lot = null;
    }
  }

  hold(doc, person) {
    this.detach(doc);
    doc.holder = person;
    (person.papers ||= new Set()).add(doc);
  }

  put(doc, containerId, text) {
    const c = typeof containerId === 'string' ? this.container(containerId) : containerId;
    this.detach(doc);
    doc.container = c;
    c.docs.add(doc);
    if (text !== false) this.note(doc, text || `put in ${c.name}`);
  }

  attach(doc, lot) {
    this.detach(doc);
    doc.lot = lot;
    (lot.papers ||= new Set()).add(doc);
  }

  // Take every document from a container (optionally only some) into a
  // person's hands.
  collect(containerId, person, filter = () => true) {
    const c = this.container(containerId);
    const got = [...c.docs].filter(filter);
    for (const d of got) {
      this.hold(d, person);
      this.note(d, `collected by ${person.name}`);
    }
    return got;
  }

  // Put everything a person holds (optionally only some) into a container.
  deliver(person, containerId, filter = () => true) {
    const got = [...(person.papers || [])].filter(filter);
    for (const d of got) this.put(d, containerId);
    return got;
  }

  mark(doc, mark, text) {
    doc.marks.push({ t: this.world.sim.now, mark });
    this.note(doc, text || mark);
  }

  addContainer({ id, name, node, kind = 'tray' }) {
    const c = { id, name, node, kind, docs: new Set() };
    this.containers.set(id, c);
    return c;
  }

  container(id) {
    const c = this.containers.get(id);
    if (!c) throw new Error(`no container ${id}`);
    return c;
  }

  addBook({ id, title, node, columns = [] }) {
    const b = { id, title, node, columns, entries: [] };
    this.books.set(id, b);
    return b;
  }

  enter(bookId, entry, { from = null, by = null } = {}) {
    const b = this.books.get(bookId);
    const e = { t: this.world.sim.now, ...entry, from: from ? from.id : null, by: by ? by.name : null };
    b.entries.push(e);
    if (from) this.note(from, `entered in the ${b.title}`);
    return e;
  }

  // Where a document physically is, as a node id (for drawing).
  whereabouts(doc) {
    if (doc.holder) return { person: doc.holder };
    if (doc.container) return { node: doc.container.node };
    if (doc.lot) return { lot: doc.lot };
    return {};
  }
}
