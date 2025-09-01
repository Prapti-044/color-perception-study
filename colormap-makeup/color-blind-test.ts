import { JumpFunctionParameters, JumpFunctionReturnVal } from '../../src/store/types';

export default function func({ answers }: JumpFunctionParameters<{ name: string }>): JumpFunctionReturnVal {
    console.log(answers);

    return { component: "color-blind-failed-component" };
    // return { component: null };
}