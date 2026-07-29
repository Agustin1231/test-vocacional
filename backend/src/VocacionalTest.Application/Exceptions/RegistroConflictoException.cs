namespace VocacionalTest.Application.Exceptions;

/// <summary>
/// El registro entrante no se puede aplicar sobre la base tal como está: el
/// correo o el documento pertenecen a una cuenta del sistema, o choca con un
/// índice único. El controller la traduce a un 409 con `{ mensaje }` en vez de
/// dejar que salga un 500.
/// </summary>
public class RegistroConflictoException : Exception
{
    public RegistroConflictoException(string mensaje) : base(mensaje) { }

    public RegistroConflictoException(string mensaje, Exception inner) : base(mensaje, inner) { }
}
