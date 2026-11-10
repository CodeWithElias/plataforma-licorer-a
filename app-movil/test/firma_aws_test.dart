import 'package:flutter_test/flutter_test.dart';

import 'package:app_movil/servicios/firma_aws.dart';

void main() {
  // Ejemplo oficial de AWS "GET Object" (Signature V4 para S3, documentación de Amazon S3)
  test('firma igual que el ejemplo oficial de AWS', () {
    const vacio = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
    final fecha = DateTime.utc(2013, 5, 24);

    final autorizacion = firmarSigV4(
      metodo: 'GET',
      ruta: '/test.txt',
      cabeceras: {
        'Host': 'examplebucket.s3.amazonaws.com',
        'Range': 'bytes=0-9',
        'x-amz-content-sha256': vacio,
        'x-amz-date': fechaAmz(fecha),
      },
      hashCuerpo: vacio,
      credenciales: const CredencialesAws(
        accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
        secretKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
      ),
      region: 'us-east-1',
      servicio: 's3',
      fecha: fecha,
    );

    expect(
      autorizacion,
      'AWS4-HMAC-SHA256 Credential=AKIAIOSFODNN7EXAMPLE/20130524/us-east-1/s3/aws4_request, '
      'SignedHeaders=host;range;x-amz-content-sha256;x-amz-date, '
      'Signature=f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41',
    );
  });

  test('credenciales por vencer en menos de 5 minutos ya no se usan', () {
    CredencialesAws vencen(Duration d) =>
        CredencialesAws(accessKeyId: 'a', secretKey: 'b', expiran: DateTime.now().add(d));

    expect(vencen(const Duration(minutes: 30)).vigentes, isTrue);
    expect(vencen(const Duration(minutes: 2)).vigentes, isFalse);
  });
}
