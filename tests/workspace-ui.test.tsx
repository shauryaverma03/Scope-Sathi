import React from "react";
import {test} from "node:test";
import assert from "node:assert/strict";
import {renderToStaticMarkup} from "react-dom/server";
import {ApprovedWorkspace,EnhancedHistory,TaskPlanPanel} from "../src/WorkspaceViews";
import {VersionComparison} from "../src/WorkspacePanels";
import {createProject,approveBaseline} from "../server/domain";
const owner={uid:"owner",email:"owner@example.com",name:"Owner"};
function fixture(){
 const p=createProject(owner,"UI fixture","","");
 approveBaseline(p,owner,"Customers must search products.",[{id:"REQ-001",text:"Customers must search products.",quote:"Customers must search products."}]);
 return p;
}
const run=async(fn:()=>Promise<void>)=>{await fn();};
test("approved scope presents amendment controls only to writers and handles a single version meaningfully",()=>{
 const p=fixture();
 const props={p,busy:false,run,onCreated:()=>{}};
 const editor=renderToStaticMarkup(<ApprovedWorkspace {...props} canEdit/>);
 assert.match(editor,/Propose edit/);assert.match(editor,/Propose removal/);
 const viewer=renderToStaticMarkup(<ApprovedWorkspace {...props} canEdit={false}/>);
 assert.doesNotMatch(viewer,/>Propose edit</);
 const comparison=renderToStaticMarkup(<VersionComparison p={p}/>);
 assert.match(comparison,/first agreement/);assert.doesNotMatch(comparison,/Unchanged/);
});
test("history exposes independently focusable scroll regions and no fabricated decisions",()=>{
 const p=fixture();
 const markup=renderToStaticMarkup(<EnhancedHistory p={p} open={()=>{}}/>);
 assert.match(markup,/aria-label="Scrollable decision trail"/);
 assert.match(markup,/aria-label="Scrollable baseline archive"/);
 assert.match(markup,/tabindex="0"/);
 assert.match(markup,/No request decisions yet/);
 assert.match(markup,/Initial baseline approved/);
});
test("task planning remains a preview and is unavailable without write permission",()=>{
 const p=fixture();
 const html=renderToStaticMarkup(<TaskPlanPanel p={p} busy={false} run={run} update={()=>{}} canEdit={false}/>);
 assert.match(html,/1 feature requirements have no linked task/);
 assert.match(html,/<button[^>]+disabled=""[^>]*>Preview task plan/);
 assert.equal(p.tasks.length,0);
});
