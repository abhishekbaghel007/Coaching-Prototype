/** Real NEET questions will be supplied later. No fabricated question bank is included. */
export type NEETQuestion={id:string;question:string;options:string[];correct_index:number;subject:'Physics'|'Chemistry'|'Biology';chapter?:string;topic?:string;difficulty?:'Easy'|'Medium'|'Hard';year?:string;source?:string;explanation?:string};
export const QUESTIONS:NEETQuestion[]=[];
