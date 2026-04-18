import {it, expect, expectTypeOf} from  'vitest';

import Autocomplete from "../dist/autocomplete";

let form = document.createElement("form");
// Make our form available to jsdom
document.body.appendChild(form);

let singleEl = document.createElement("input");
singleEl.classList.add("autocomplete");
form.appendChild(singleEl);

let disabledEl = document.createElement("input");
disabledEl.classList.add("autocomplete");
disabledEl.setAttribute("disabled", "");
form.appendChild(disabledEl);

// Somehow new Event syntax is not working
Event = window.Event;

it("it can create", (t) => {
  let inst = new Autocomplete(singleEl);
  expectTypeOf(inst.constructor).toEqualTypeOf(Autocomplete);
});

it("it can use init", (t) => {
  Autocomplete.init("input.autocomplete");
  let inst = Autocomplete.getInstance(singleEl);
  expectTypeOf(inst).toEqualTypeOf(Autocomplete);
});

it("it can be disabled", (t) => {
  let disabledTags = Autocomplete.getInstance(disabledEl);
  let regularTags = Autocomplete.getInstance(singleEl);
  expect(disabledTags.isDisabled()).to.equal(true);
  expect(regularTags.isDisabled()).to.equal(false);
});

it("it doesn't contain debug log", (t) => {
  let count = (Autocomplete.toString().match(/console\.log/g) || []).length;
  expect(count, "The dev should pay more attention").to.equal(0);
});
