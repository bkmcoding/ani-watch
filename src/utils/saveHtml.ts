import * as path from 'path';

const saveHtml = async (html: string, fileName: string) => {
  console.log(html);

  try {
    const fullPath = path.join(import.meta.dir + '../../../htmls/' + fileName);

    console.log(fullPath);

    await Bun.write(fullPath, html);
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.log('something went wrong' + error.message);
    }
  }
};

export default saveHtml;
