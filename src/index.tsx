import {connect, IntentCtx, RenderFieldExtensionCtx} from 'datocms-plugin-sdk';
import 'datocms-react-ui/styles.css';
import ConfigScreen from './entrypoints/ConfigScreen';
import {render} from './utils/render';
import {SameLocaleLinks} from "./components/SameLocaleLinks";

connect({
    renderConfigScreen(ctx) {
        return render(<ConfigScreen ctx={ctx}/>);
    },

    manualFieldExtensions(ctx: IntentCtx) {
        return [
            {
                id: 'sameLocaleLinks',
                name: 'Same-Locale Links',
                type: 'editor',
                fieldTypes: ['links'],
            },
        ];
    },

    renderFieldExtension(fieldExtensionId: string, ctx: RenderFieldExtensionCtx) {
        switch (fieldExtensionId) {
            case 'sameLocaleLinks':
                return render(<SameLocaleLinks ctx={ctx}/>);
        }
    }

});
