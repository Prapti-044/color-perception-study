import { JumpFunctionParameters, JumpFunctionReturnVal } from '../../src/store/types';

export default function func({ answers }: JumpFunctionParameters<{ name: string }>): JumpFunctionReturnVal {
    console.log("This is not printing!");

    return { component: "color-blind-failed-component" };
    // return { component: null }; // This also does not work
}