const puppeteer = {
  launch: async (): Promise<never> => {
    throw new Error('Puppeteer no esta disponible durante las pruebas');
  },
};

export default puppeteer;
