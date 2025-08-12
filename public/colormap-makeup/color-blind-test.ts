import { JumpFunctionParameters, JumpFunctionReturnVal } from '../../src/store/types';

console.log("Rahat")

export default function func({ answers }: JumpFunctionParameters<{ name: string }>): JumpFunctionReturnVal {
    console.log(answers);
    console.log("This is a Test. This is not printing!");

    return { component: "color-blind-failed-component" };
    // return { component: null }; // This also does not work
}