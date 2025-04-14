import { LightningElement, track, wire, api } from 'lwc';
import { CloseActionScreenEvent } from 'lightning/actions';

const isDebugMode = true;

export default class GuidedAccountEdit extends LightningElement {
    @api recordId;
    isEdit = true;


    hanldeClose(event) {
	    if(isDebugMode) {
           console.log('Event details', event.detail);
		}
        if (event.detail) {
            this.dispatchEvent(new CloseActionScreenEvent());
        }
   }
}
